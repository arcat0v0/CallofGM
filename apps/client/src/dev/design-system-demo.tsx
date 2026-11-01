import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  HouseIcon,
  MenuIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  Volume2Icon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppBar } from "@/components/ui/app-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup, SplitButton } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip, FilterChip, InputChip } from "@/components/ui/chip";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Fab, FabMenu } from "@/components/ui/fab";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { List, ListItem } from "@/components/ui/list";
import { LoadingIndicator, Shape } from "@/components/ui/loading-indicator";
import { Navigation, NavigationItem } from "@/components/ui/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { DatePicker, TimePicker } from "@/components/ui/pickers";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CircularProgress, Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RefreshIndicator } from "@/components/ui/refresh-indicator";
import { SearchBar, SearchView } from "@/components/ui/search";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarToggleGroup,
  ToolbarToggleItem,
} from "@/components/ui/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import shapes from "@/lib/expressive-shapes.json";
function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="flex scroll-mt-8 flex-col gap-8 rounded-2xl bg-md-surface-container-low p-6 md:p-10"
    >
      <header>
        <p className="text-label-large text-accent">{id}</p>
        <h2 className="mt-2 font-serif text-headline-large-emph">{title}</h2>
        <p className="mt-3 text-body-large text-foreground-muted">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}
function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>;
}
function ActionsMenu() {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>演绎操作</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => toast("已放行发言")}>
        放行发言
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => toast("已标记稍后处理")}>
        稍后处理
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled>暂无更多待处理发言</DropdownMenuItem>
    </DropdownMenuGroup>
  );
}

function NavigationDemo({ variant }: { variant: "rail" | "bar" | "drawer" }) {
  const [selected, setSelected] = useState("modules");
  const items = [
    { id: "home", label: "首页", icon: HouseIcon },
    { id: "modules", label: "模组", icon: BookOpenIcon },
    { id: "music", label: "音乐", icon: MusicIcon },
  ];
  return (
    <Navigation variant={variant} aria-label={`导航 ${variant}`}>
      {items.map(({ id, label, icon: Icon }) => (
        <NavigationItem
          key={id}
          href="#03"
          active={selected === id}
          icon={<Icon />}
          onClick={(event) => {
            event.preventDefault();
            setSelected(id);
          }}
        >
          {label}
        </NavigationItem>
      ))}
    </Navigation>
  );
}

function DesignSystemDemo() {
  const [motion, setMotion] = useState("expressive");
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState([42]);
  const [tab, setTab] = useState("all");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("21:02");
  const [chip, setChip] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  return (
    <main
      data-motion={motion}
      className="mx-auto flex max-w-7xl flex-col gap-8 p-4 pb-24 md:p-10"
    >
      <header className="flex flex-wrap items-end justify-between gap-8 py-8">
        <div>
          <p className="text-label-large text-accent">
            CoGM / MATERIAL 3 EXPRESSIVE
          </p>
          <h1 className="mt-3 font-serif text-display-medium-emph">
            让每一次操作，都有回应。
          </h1>
          <p className="mt-4 max-w-2xl text-body-large text-foreground-muted">
            组件、状态与动效实验室。基于 Dart 规格重绘，以项目配色和 Radix
            行为落地。
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={motion}
          onValueChange={(value) => {
            if (value) setMotion(value);
          }}
          aria-label="动效方案"
        >
          <ToggleGroupItem value="standard">Standard</ToggleGroupItem>
          <ToggleGroupItem value="expressive">Expressive</ToggleGroupItem>
        </ToggleGroup>
      </header>
      <Section
        id="01"
        title="动作，有轻重之分。"
        subtitle="五种按钮表面、五档 Expressive 尺寸，以及按压形状变化。"
      >
        <Row>
          {(["filled", "tonal", "elevated", "outline", "text"] as const).map(
            (variant) => (
              <Button
                key={variant}
                variant={variant}
                size="md"
                onClick={() => toast(`${variant} 已触发`)}
              >
                <PlusIcon data-icon="inline-start" />
                {variant}
              </Button>
            ),
          )}
        </Row>
        <Row>
          {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
            <Button key={size} size={size} shape="square">
              继续
            </Button>
          ))}
        </Row>
        <Row>
          <Button disabled>不可用</Button>
          <Button variant="danger">结束团</Button>
          <ButtonGroup aria-label="播放控制">
            <Button variant="tonal" aria-label="播放">
              <PlayIcon />
            </Button>
            <Button variant="tonal" aria-label="暂停">
              <PauseIcon />
            </Button>
            <Button variant="tonal" aria-label="音量">
              <Volume2Icon />
            </Button>
          </ButtonGroup>
          <SplitButton menu={<ActionsMenu />} onClick={() => toast("已放行")}>
            放行发言
          </SplitButton>
        </Row>
        <Row>
          <ToggleGroup type="single" defaultValue="play" aria-label="团内阶段">
            <ToggleGroupItem value="free">自由讨论</ToggleGroupItem>
            <ToggleGroupItem value="play">演绎时间</ToggleGroupItem>
            <ToggleGroupItem value="cg">强制 CG</ToggleGroupItem>
          </ToggleGroup>
          <Toggle aria-label="收藏场景">
            <BookOpenIcon />
            收藏
          </Toggle>
        </Row>
        <Row>
          {(["narrow", "default", "wide"] as const).map((width) => (
            <IconButton
              key={width}
              width={width}
              aria-label={`${width} 播放`}
              selected={playing}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          ))}
          <Fab size="sm" aria-label="新建">
            <PlusIcon />
          </Fab>
          <Fab aria-label="新建">
            <PlusIcon />
          </Fab>
          <Fab size="lg" tone="tertiary" aria-label="新建">
            <PlusIcon />
          </Fab>
          <Fab extended>
            <PlusIcon />
            新建团
          </Fab>
          <FabMenu
            trigger={
              <Fab extended tone="secondary">
                <PlusIcon />
                更多操作
              </Fab>
            }
          >
            <ActionsMenu />
          </FabMenu>
        </Row>
      </Section>
      <Section
        id="02"
        title="选择，自然发生。"
        subtitle="控件共用状态层；焦点、错误与禁用状态保持清楚可见。"
      >
        <Row>
          <Chip icon={<PlusIcon className="size-4" />}>添加场景</Chip>
          <FilterChip defaultPressed>仅看 PC</FilterChip>
          <FilterChip>未读</FilterChip>
          {chip && (
            <InputChip
              onRemove={() => setChip(false)}
              removeLabel="移除图书馆标签"
            >
              图书馆
            </InputChip>
          )}
          <Button variant="text" onClick={() => setChip(true)}>
            恢复标签
          </Button>
        </Row>
        <div className="grid gap-8 md:grid-cols-3">
          <FieldGroup>
            <TextField
              label="团名称"
              defaultValue="沉没的记忆"
              description="将在邀请页展示"
            />
            <TextField label="房间代号" variant="outlined" />
            <TextField
              label="邀请链接"
              defaultValue="不完整的链接"
              error="请输入有效的团邀请链接"
            />
            <TextField label="主持人" value="KP" disabled />
          </FieldGroup>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="notes">备注</FieldLabel>
              <Textarea id="notes" placeholder="记下下一幕的线索…" />
            </Field>
            <Field>
              <FieldLabel htmlFor="find">搜索角色</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput id="find" placeholder="输入角色名" />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="otp">房间验证码</FieldLabel>
              <InputOTP id="otp" maxLength={4}>
                <InputOTPGroup>
                  {[0, 1, 2, 3].map((index) => (
                    <InputOTPSlot index={index} key={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Row>
              <Checkbox id="check" defaultChecked />
              <Label htmlFor="check">允许观战</Label>
              <Checkbox checked="indeterminate" aria-label="部分选择" />
              <Checkbox disabled aria-label="不可选" />
            </Row>
            <Row>
              <Switch id="audio" defaultChecked />
              <Label htmlFor="audio">同步音乐</Label>
              <Switch disabled aria-label="禁用音乐" />
            </Row>
            <RadioGroup defaultValue="normal" aria-label="难度">
              <Row>
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal">常规</Label>
                <RadioGroupItem value="hard" id="hard" />
                <Label htmlFor="hard">困难</Label>
              </Row>
            </RadioGroup>
            <Select defaultValue="pc">
              <SelectTrigger aria-label="角色类型">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="pc">玩家角色 PC</SelectItem>
                  <SelectItem value="npc">非玩家角色 NPC</SelectItem>
                  <SelectItem value="ob" disabled>
                    旁观者 OB
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        <Row>
          <div className="min-w-64 flex-1">
            <Slider aria-label="单值滑块" defaultValue={[35]} />
          </div>
          <div className="min-w-64 flex-1">
            <Slider
              thumbLabels={["最小范围", "最大范围"]}
              defaultValue={[20, 75]}
            />
          </div>
          <Slider
            aria-label="垂直滑块"
            orientation="vertical"
            defaultValue={[60]}
          />
        </Row>
        <Card variant="secondary">
          <CardHeader>
            <CardTitle>雨夜的图书馆</CardTitle>
            <CardDescription>波浪播放轨道 · 拖动时舒展为直线</CardDescription>
          </CardHeader>
          <Row>
            <IconButton
              aria-label={playing ? "暂停" : "播放"}
              selected={playing}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
            <div className="min-w-48 flex-1">
              <Slider
                aria-label="播放进度"
                value={progress}
                onValueChange={setProgress}
                wavy
                playing={playing}
              />
            </div>
            <span className="font-mono text-label-large">{progress[0]}%</span>
          </Row>
        </Card>
      </Section>
      <Section
        id="03"
        title="去哪里，一目了然。"
        subtitle="App bar、导航栏、导航轨、导航抽屉与工具栏。"
      >
        <AppBar
          title="沉没的记忆"
          subtitle="第三夜 · 雨夜的图书馆"
          size="large"
          leading={
            <IconButton aria-label="菜单" variant="text">
              <MenuIcon />
            </IconButton>
          }
          actions={<Button variant="tonal">邀请玩家</Button>}
        />
        <Row>
          <NavigationDemo variant="rail" />
          <NavigationDemo variant="drawer" />
          <Toolbar aria-label="场景工具">
            <ToolbarButton aria-label="添加">
              <PlusIcon />
            </ToolbarButton>
            <ToolbarButton aria-label="搜索">
              <SearchIcon />
            </ToolbarButton>
            <ToolbarSeparator />
            <ToolbarToggleGroup type="single" defaultValue="music">
              <ToolbarToggleItem value="music" aria-label="音乐">
                <MusicIcon />
              </ToolbarToggleItem>
              <ToolbarToggleItem value="book" aria-label="资料">
                <BookOpenIcon />
              </ToolbarToggleItem>
            </ToolbarToggleGroup>
          </Toolbar>
        </Row>
        <NavigationDemo variant="bar" />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="频道">
            <TabsTrigger value="all">全部消息</TabsTrigger>
            <TabsTrigger value="character">角色演绎</TabsTrigger>
            <TabsTrigger value="off">场外讨论</TabsTrigger>
          </TabsList>
          <TabsContent value="all">全部频道的动态在这里汇集。</TabsContent>
          <TabsContent value="character">
            远野 澪：我们得在雨停之前赶到船屋。
          </TabsContent>
          <TabsContent value="off">玩家：先让我翻一下调查笔记。</TabsContent>
        </Tabs>
        <SearchBar />
        <SearchView
          trigger={
            <Button variant="tonal">
              <SearchIcon />
              展开搜索视图
            </Button>
          }
        >
          <SearchBar />
          <List>
            <ListItem
              headline="沉没的记忆"
              supporting="模组 · 最后编辑于今天"
            />
          </List>
        </SearchView>
      </Section>
      <Section
        id="04"
        title="容器，让内容有秩序。"
        subtitle="卡片、列表、日历、时钟、轮播与各类浮层。"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {(["default", "elevated", "outlined"] as const).map((variant) => (
            <Card key={variant} variant={variant}>
              <CardHeader>
                <CardTitle>雨夜的图书馆</CardTitle>
                <CardDescription>{variant} card</CardDescription>
              </CardHeader>
              <CardContent>
                雨声突然变大了。你们脚下的木地板传来一阵低沉的呻吟声。
              </CardContent>
            </Card>
          ))}
        </div>
        <List>
          <ListItem
            headline="远野 澪"
            supporting="调查员 · 等待演绎"
            leading={
              <Avatar>
                <AvatarFallback>澪</AvatarFallback>
              </Avatar>
            }
            trailing={<Button size="sm">放行</Button>}
          />
          <ListItem
            headline="白石 拓真"
            supporting="调查员 · 当前场景可见"
            leading={
              <Avatar>
                <AvatarFallback>拓</AvatarFallback>
              </Avatar>
            }
            trailing={<Switch defaultChecked aria-label="显示白石拓真" />}
          />
        </List>
        <Row>
          <Calendar mode="single" selected={date} onSelect={setDate} />
          <DatePicker value={date} onChange={setDate} />
          <TimePicker value={time} onChange={setTime} />
        </Row>
        <Carousel className="mx-12">
          <CarouselContent>
            {["图书馆", "船屋", "湖底祭坛"].map((name, index) => (
              <CarouselItem key={name} className="basis-4/5 md:basis-1/2">
                <Card variant="secondary">
                  <Shape
                    shape={
                      (["arch", "softBurst", "clover4Leaf"] as const)[index]
                    }
                    className="size-24"
                  />
                  <CardTitle>{name}</CardTitle>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
        <Row>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="tonal">打开对话框</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>切换到下一幕？</DialogTitle>
              <DialogDescription>所有玩家会同步进入船屋。</DialogDescription>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="text">暂不切换</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button onClick={() => toast("场景预览已切换")}>
                    进入船屋
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="dangerSoft">结束演示</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>结束本次演示？</AlertDialogTitle>
              <AlertDialogDescription>
                这是组件预览，不会改变实际团状态。
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={() => toast("演示操作已确认")}>
                  确定
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="tonal">侧边面板</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>场景设置</SheetTitle>
                <SheetDescription>侧边面板容纳补充操作。</SheetDescription>
              </SheetHeader>
              <SheetBody>
                <TextField label="场景名称" defaultValue="图书馆" />
              </SheetBody>
            </SheetContent>
          </Sheet>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="tonal">底部面板</Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="mx-auto w-full max-w-lg p-6">
                <DrawerTitle>音频队列</DrawerTitle>
                <DrawerDescription>拖动面板可收起。</DrawerDescription>
                <List>
                  <ListItem headline="雨夜的图书馆" trailing={<MusicIcon />} />
                </List>
              </div>
            </DrawerContent>
          </Drawer>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                操作菜单
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <ActionsMenu />
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">情报浮层</Button>
            </PopoverTrigger>
            <PopoverContent>
              <h3 className="text-title-medium">调查笔记</h3>
              <p className="mt-2 text-body-medium">
                目录最后一页反复刻着：不要开门。
              </p>
            </PopoverContent>
          </Popover>
        </Row>
      </Section>
      <Section
        id="05"
        title="正在发生，清晰可感。"
        subtitle="直线与波浪进度、形状加载、消息和系统反馈。"
      >
        <div className="grid gap-8 md:grid-cols-2">
          <FieldGroup>
            <Progress aria-label="资源加载" value={progress[0]} />
            <Progress
              aria-label="波浪加载"
              value={progress[0]}
              wavy
              playing={playing}
            />
            <Progress aria-label="正在同步" />
            <Progress aria-label="波浪同步" wavy />
          </FieldGroup>
          <Row>
            <CircularProgress aria-label="圆形进度" value={progress[0]} />
            <CircularProgress
              aria-label="波浪圆形进度"
              value={progress[0]}
              wavy
            />
            <CircularProgress aria-label="同步中" wavy />
            <LoadingIndicator />
            <LoadingIndicator contained />
          </Row>
        </div>
        <Row>
          <Badge tone="accent">进行中</Badge>
          <Badge tone="danger" variant="soft">
            重伤
          </Badge>
          <Badge tone="success">已同步</Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="text">悬停查看提示</Button>
            </TooltipTrigger>
            <TooltipContent>仅主持人可见</TooltipContent>
          </Tooltip>
          <Button
            variant="tonal"
            onClick={() =>
              toast("场景已保存", {
                action: {
                  label: "撤销",
                  onClick: () => toast("已撤销演示操作"),
                },
              })
            }
          >
            显示 Snackbar
          </Button>
          <RefreshIndicator
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
            }}
          />
          <Button variant="text" onClick={() => setRefreshing(false)}>
            结束加载
          </Button>
        </Row>
        <Alert>
          <AlertIcon>
            <CheckIcon />
          </AlertIcon>
          <AlertContent>
            <AlertTitle>所有玩家已准备就绪</AlertTitle>
            <AlertDescription>可以开始下一幕的演绎。</AlertDescription>
          </AlertContent>
        </Alert>
        <Separator />
        <Accordion type="single" collapsible>
          <AccordionItem value="detail">
            <AccordionTrigger>查看团内状态说明</AccordionTrigger>
            <AccordionContent>
              组件预览使用本地演示状态，不会连接实际团或发送消息。
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>角色</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>远野 澪</TableCell>
              <TableCell>PC</TableCell>
              <TableCell>
                <Badge tone="success" variant="soft">
                  就绪
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>白石 拓真</TableCell>
              <TableCell>PC</TableCell>
              <TableCell>调查中</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#05"
                onClick={() => setPage(Math.max(1, page - 1))}
              />
            </PaginationItem>
            {[1, 2, 3].map((number) => (
              <PaginationItem key={number}>
                <PaginationLink
                  href="#05"
                  isActive={page === number}
                  onClick={() => setPage(number)}
                >
                  {number}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#05"
                onClick={() => setPage(Math.min(3, page + 1))}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Section>
      <Section
        id="06"
        title="35 种形状，同一个体系。"
        subtitle="从 Dart RoundedPolygon 原始三次贝塞尔曲线导出。加载动效按七个源形状循环。"
      >
        <div className="grid grid-cols-3 gap-6 sm:grid-cols-5 lg:grid-cols-7">
          {(Object.keys(shapes) as (keyof typeof shapes)[]).map((name) => (
            <div
              key={name}
              className="flex flex-col items-center gap-4 rounded-xl bg-md-surface-container p-4"
            >
              <Shape shape={name} className="size-16" />
              <span className="max-w-full break-all text-label-small text-foreground-muted">
                {name}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <p className="text-body-small text-foreground-muted">
        开发环境预览 · 生产环境不提供此页面 ·
        系统“减弱动态效果”会停止循环与形状动画。
      </p>
    </main>
  );
}

export { DesignSystemDemo };
