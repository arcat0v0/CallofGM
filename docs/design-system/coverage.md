# Expressive 组件覆盖

固定来源见 [upstream.lock.json](upstream.lock.json)。下表是组件族级覆盖；不等于 Flutter 的每个构造参数、布局模式和原生手势均已一比一迁移。每一项均提供 Web 组件与 Pen 静态样式。平台差异见 [README](README.md)。

| Dart 入口（lib/components） | Web 组件 | Pen 画板 |
|---|---|---|
| app_bars | AppBar（`app-bar.tsx`） | 03 |
| badges | Badge（`badge.tsx`） | 05 |
| bottom_sheets | Drawer（`drawer.tsx`） | 04 |
| buttons | Button / ButtonGroup（`button.tsx` / `button-group.tsx`） | 01 |
| cards | Card（`card.tsx`） | 04 |
| carousel | Carousel（`carousel.tsx`） | 04 |
| checkbox | Checkbox（`checkbox.tsx`） | 02 |
| chips | Chip / FilterChip / InputChip（`chip.tsx`） | 02 |
| date_pickers | Calendar / DatePicker（`calendar.tsx` / `pickers.tsx`） | 04 |
| dialogs | Dialog / AlertDialog（`dialog.tsx` / `alert-dialog.tsx`） | 04 |
| divider | Separator（`separator.tsx`） | 05 |
| dropdown_menus | Select / DropdownMenu（`select.tsx` / `dropdown-menu.tsx`） | 04 |
| extended_fabs | Fab extended（`fab.tsx`） | 01 |
| fab_menu | FabMenu（`fab.tsx`） | 01 |
| floating_action_buttons | Fab（`fab.tsx`） | 01 |
| icon_buttons | IconButton（`icon-button.tsx`） | 01 |
| lists | List / ListItem（`list.tsx`） | 04 |
| loading_indicator | LoadingIndicator / Spinner（`loading-indicator.tsx`） | 06 |
| menus | DropdownMenu（`dropdown-menu.tsx`） | 04 |
| navigation_bar | Navigation variant=bar（`navigation.tsx`） | 03 |
| navigation_drawer | Navigation variant=drawer / Sheet（`navigation.tsx` / `sheet.tsx`） | 03 |
| navigation_rail | Navigation variant=rail（`navigation.tsx`） | 03 |
| progress_indicators | Progress / CircularProgress（`progress.tsx`） | 05 |
| radio_button | RadioGroup / RadioGroupItem（`radio-group.tsx`） | 02 |
| refresh_indicator | RefreshIndicator（`refresh-indicator.tsx`） | 05 |
| search | SearchBar / SearchView（`search.tsx`） | 03 |
| segmented_buttons | ToggleGroup（`toggle-group.tsx`） | 01 |
| selection | Checkbox / RadioGroup / Switch（`checkbox.tsx` / `radio-group.tsx` / `switch.tsx`） | 02 |
| side_sheets | Sheet（`sheet.tsx`） | 04 |
| sliders | Slider（`slider.tsx`） | 02 |
| snackbar | Toaster / sonner toast（`sonner.tsx`） | 05 |
| split_buttons | SplitButton（`button-group.tsx`） | 01 |
| switch_control | Switch（`switch.tsx`） | 02 |
| tabs | Tabs（`tabs.tsx`） | 03 |
| text_fields | Input / Textarea / TextField（`input.tsx` / `textarea.tsx` / `text-field.tsx`） | 02 |
| time_pickers | TimePicker（`pickers.tsx`） | 04 |
| toggle_button | Toggle（`toggle.tsx`） | 01 |
| toggle_button_group | ToggleGroup（`toggle-group.tsx`） | 01 |
| toolbars | Toolbar（`toolbar.tsx`） | 03 |
| tooltips | Tooltip（`tooltip.tsx`） | 05 |

## 原有 27 个组件

全部经 expressive.css 的 data-slot 样式重绘，含表面、尺寸、状态、字阶和适用的动效。Button、Avatar、Card、Checkbox、Progress、Slider、Tabs、Alert、Sonner 另有组件结构或变体调整；其余复用原有 Radix/HTML 结构。

- `accordion`
- `alert-dialog`
- `alert`
- `avatar`
- `badge`
- `button`
- `card`
- `checkbox`
- `dialog`
- `dropdown-menu`
- `input-group`
- `input-otp`
- `input`
- `label`
- `pagination`
- `popover`
- `progress`
- `radio-group`
- `select`
- `separator`
- `slider`
- `sonner`
- `switch`
- `table`
- `tabs`
- `textarea`
- `tooltip`

## Pen 画板

- `fqvcM` — 01 · Actions
- `LKyqj` — 02 · Selection & Input
- `CRV22` — 03 · Navigation
- `p6R8dj` — 04 · Containment
- `z0FfP` — 05 · Feedback & Extensions
- `C3Iv4d` — 06 · Foundations & Motion

旧 HeroUI 组件与旧页面不作为本组件库实例源；新库使用 M3/ 命名。对话框内已使用新 Button 的 ref 实例，后续页面可直接引用新符号。
