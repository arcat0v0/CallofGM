//! DeepFilterNet3 for the CoGM voice AudioWorklet.
//!
//! Exposes a plain C ABI so the worklet can drive the module without
//! wasm-bindgen glue (AudioWorkletGlobalScope lacks TextDecoder, fetch, etc.).
//! The module has no imports. A panic aborts, which traps in the host, and the
//! worklet then falls back to RNNoise or passthrough.

use std::ptr::null_mut;

use df::tract::{DfParams, DfTract, RuntimeParams};
use ndarray::{ArrayView2, ArrayViewMut2};

fn no_entropy(_: &mut [u8]) -> Result<(), getrandom::Error> {
    Err(getrandom::Error::UNSUPPORTED)
}
getrandom::register_custom_getrandom!(no_entropy);

pub struct CogmDf {
    df: DfTract,
    input: Vec<f32>,
    output: Vec<f32>,
}

/// Allocates `len` bytes inside the module memory (for the model bytes).
#[no_mangle]
pub extern "C" fn cogm_df_alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len.max(1));
    let pointer = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    pointer
}

/// Frees a buffer returned by `cogm_df_alloc` with the same `len`.
///
/// # Safety
/// `pointer` must come from `cogm_df_alloc(len)` and not be freed twice.
#[no_mangle]
pub unsafe extern "C" fn cogm_df_free(pointer: *mut u8, len: usize) {
    if pointer.is_null() {
        return;
    }
    drop(Vec::from_raw_parts(pointer, 0, len.max(1)));
}

/// Creates a DeepFilterNet3 state from a `.tar.gz` ONNX model.
/// Returns null when the model cannot be loaded.
///
/// # Safety
/// `model` must point to `len` readable bytes.
#[no_mangle]
pub unsafe extern "C" fn cogm_df_create(
    model: *const u8,
    len: usize,
    atten_lim_db: f32,
    post_filter_beta: f32,
) -> *mut CogmDf {
    if model.is_null() || len == 0 {
        return null_mut();
    }
    let bytes = std::slice::from_raw_parts(model, len);
    let Ok(params) = DfParams::from_bytes(bytes) else {
        return null_mut();
    };
    let runtime = RuntimeParams::default_with_ch(1)
        .with_atten_lim(atten_lim_db)
        .with_post_filter(post_filter_beta.max(0.));
    let Ok(df) = DfTract::new(params, &runtime) else {
        return null_mut();
    };
    let hop = df.hop_size;
    Box::into_raw(Box::new(CogmDf {
        df,
        input: vec![0.; hop],
        output: vec![0.; hop],
    }))
}

/// # Safety
/// `state` must come from `cogm_df_create` and not be destroyed.
#[no_mangle]
pub unsafe extern "C" fn cogm_df_frame_length(state: *const CogmDf) -> usize {
    state.as_ref().map_or(0, |state| state.df.hop_size)
}

/// Pointer to the input frame (`frame_length` f32 samples, range -1..1).
///
/// # Safety
/// `state` must come from `cogm_df_create` and not be destroyed.
#[no_mangle]
pub unsafe extern "C" fn cogm_df_input(state: *mut CogmDf) -> *mut f32 {
    state
        .as_mut()
        .map_or(null_mut(), |state| state.input.as_mut_ptr())
}

/// Pointer to the output frame (`frame_length` f32 samples).
///
/// # Safety
/// `state` must come from `cogm_df_create` and not be destroyed.
#[no_mangle]
pub unsafe extern "C" fn cogm_df_output(state: *mut CogmDf) -> *mut f32 {
    state
        .as_mut()
        .map_or(null_mut(), |state| state.output.as_mut_ptr())
}

/// Processes the input frame into the output frame.
/// Returns the local SNR estimate in dB, or NaN on failure.
///
/// # Safety
/// `state` must come from `cogm_df_create` and not be destroyed.
#[no_mangle]
pub unsafe extern "C" fn cogm_df_process(state: *mut CogmDf) -> f32 {
    let Some(state) = state.as_mut() else {
        return f32::NAN;
    };
    let hop = state.df.hop_size;
    let Ok(input) = ArrayView2::from_shape((1, hop), state.input.as_slice()) else {
        return f32::NAN;
    };
    let Ok(output) = ArrayViewMut2::from_shape((1, hop), state.output.as_mut_slice()) else {
        return f32::NAN;
    };
    state.df.process(input, output).unwrap_or(f32::NAN)
}

/// Sets the attenuation limit in dB (>= 100 means unlimited).
///
/// # Safety
/// `state` must come from `cogm_df_create` and not be destroyed.
#[no_mangle]
pub unsafe extern "C" fn cogm_df_set_atten_lim(state: *mut CogmDf, atten_lim_db: f32) {
    if let Some(state) = state.as_mut() {
        state.df.set_atten_lim(atten_lim_db);
    }
}

/// Sets the post-filter beta (0 disables it).
///
/// # Safety
/// `state` must come from `cogm_df_create` and not be destroyed.
#[no_mangle]
pub unsafe extern "C" fn cogm_df_set_post_filter_beta(state: *mut CogmDf, beta: f32) {
    if let Some(state) = state.as_mut() {
        state.df.set_pf_beta(beta.max(0.));
    }
}

/// # Safety
/// `state` must come from `cogm_df_create` and not be destroyed twice.
#[no_mangle]
pub unsafe extern "C" fn cogm_df_destroy(state: *mut CogmDf) {
    if !state.is_null() {
        drop(Box::from_raw(state));
    }
}
