/**
@module MUI

筋斗云移动UI框架 - JDCloud Mobile UI framework

## 基于逻辑页面的单网页应用

亦称“变脸式应用”。应用程序以逻辑页面（page）为基本单位，每个页面的html/js可完全分离。主要特性：

- 基于缺页中断思想的页面路由。异步无刷新页面切换。支持浏览器前进后退操作。
- 支持页面对象模型(POM)，方便基于逻辑页面的模块化开发。支持页面html片段和js片段。
- 统一对待内部页面和外部页面（同样的方式访问，同样的行为）。开发时推荐用外部页面，发布时可打包常用页面成为内部页面。
  访问任何页面都是index.html#page1的方式，如果page1已存在则使用（内部页面），不存在则动态加载（如找到fragment/page1.html）
- 页面栈管理。可自行pop掉一些页面控制返回行为。

@see MUI.showPage
@see MUI.popPageStack

### 应用容器

@key .mui-container 应用容器。
@event muiInit() DOM事件。this为当前应用容器。

先在主应用html中，用.mui-container类标识应用容器，在运行时，所有逻辑页面都将在该对象之下。如：

	<body class="mui-container">

应用初始化时会发出muiInit事件，该事件在页面加载完成($.ready)后，显示首页前调用。在这里调用MUI.showPage可动态显示首页。

### 逻辑页面

每个逻辑页面(page)以及它对应的脚本(js)均可以独立出一个文件开发，也可以直接嵌在主页面的应用容器中。

如添加一个订单页，使用外部页面，可以添加一个order.html (html片段):

	<div mui-initfn="initPageOrder" mui-script="order.js">
		...
	</div>

如果使用内部页面，则可以写为：

	<script type="text/html" id="tpl_order">
		<div mui-initfn="initPageOrder" mui-script="order.js">
			...
		</div>
	</script>

@key .mui-page 逻辑页面。
@key mui-script DOM属性。逻辑页面对应的JS文件。
@key mui-initfn DOM属性。逻辑页面对应的初始化函数，一般包含在mui-script指定的JS文件中。

该页面代码模块（即初始化函数）可以放在一个单独的文件order.js:

	function initPageOrder() 
	{
		var jpage = this;
		jpage.on("pagebeforeshow", onBeforeShow);
		jpage.on("pageshow", onShow);
		jpage.on("pagehide", onHide);
		...
	}

逻辑页面加载过程，以加载页面"#order"为例: 

	MUI.showPage("#order");

- 检查是否已加载该页面，如果已加载则显示该页并跳到"pagebeforeshow"事件这一步。
- 检查内部模板页。如果内部页面模板中有名为"tpl_{页面名}"的对象，有则将其内容做为页面代码加载，然后跳到initPage步骤。
- 加载外部模板页。加载 {pageFolder}/{页面名}.html 作为逻辑页面，如果加载失败则报错。页面所在文件夹可通过`MUI.options.pageFolder`指定。
- initPage页面初始化. 框架自动为页面添加.mui-page类。如果逻辑页面上指定了mui-script属性，则先加载该属性指定的JS文件。然后如果设置了mui-initfn属性，则将其作为页面初始化函数调用。
- 发出pagecreate事件。
- 发出pagebeforeshow事件。
- 动画完成后，发出pageshow事件。
- 如果之前有其它页面在显示，则触发之前页面的pagehide事件。

（v3.3）页面初始化函数可返回一个新的jpage对象，从而便于与vue等库整合，如：

	function initPageOrder() 
	{
		// vue将this当作模板，创建新的DOM对象vm.$el.
		var vm = new Vue({
			el: this[0],
			data: {},
			method: {}
		});

		var jpage = $(vm.$el);
		jpage.on("pagebeforeshow", onBeforeShow);
		...
		return jpage;
	}

@event pagecreate(ev) DOM事件。this为当前页面，习惯名为jpage。
@event pagebeforeshow(ev, opt) DOM事件。this为当前页面。opt参数为`MUI.showPage(pageRef, opt?)`中的opt，如未指定则为`{}`
@event pageshow(ev, opt)  DOM事件。this为当前页面。opt参数与pagebeforeshow事件的opt参数一样。
@event pagehide(ev) DOM事件。this为当前页面。

#### 逻辑页内嵌style

逻辑页代码片段允许嵌入style，例如：

	<div mui-initfn="initPageOrder" mui-script="order.js">
	<style>
	.p-list {
		color: blue;
	}
	.p-list div {
		color: red;
	}
	</style>
	</div>

@key mui-origin

style将被插入到head标签中，并自动添加属性`mui-origin={pageId}`.

（版本v3.2)
框架在加载页面时，会将style中的内容自动添加逻辑页前缀，以便样式局限于当前页使用，相当于：

	<style>
	#order .p-list {
		color: blue;
	}
	#order .p-list div {
		color: red;
	}
	</style>

为兼容旧版本，如果css选择器以"#{pageId} "开头，则不予处理。

@key mui-nofix
如果不希望框架自动处理，可以为style添加属性`mui-nofix`:

	<style mui-nofix>
	</style>

#### 逻辑页内嵌script

逻辑页中允许但不建议内嵌script代码，js代码应在mui-script对应的脚本中。非要使用时，注意将script放到div标签内：

	<div mui-initfn="initPageOrder" mui-script="order.js">
	<script>
	// js代码
	</script>
		...
	</div>

（版本v3.2)
如果逻辑页嵌入在script模板中，这时要使用`script`, 应换用`__script__`标签，如：

	<script type="text/html" id="tpl_order">
		<div mui-initfn="initPageOrder" mui-script="order.js">
			...
		</div>
		<__script__>
		// js代码，将在逻辑页加载时执行
		</__script__>
	</script>

#### 进入应用时动态显示初始逻辑页

默认进入应用时的主页为 MUI.options.homePage. 如果要根据参数动态显示页面，应在muiInit事件中操作：

	$(document).on("muiInit", myInit);

	function myInit()
	{
		if (g_args.initPage) {
			MUI.showPage(g_args.initPage);
		}
	}

访问`http://server/app/?initPage=me`则默认访问页面"#me".

@see muiInit

#### 在showPage过程中再显示另一个逻辑页

例如，进入页面后，发现如果未登录，则自动转向登录页：

	function onPageBeforeShow(ev)
	{
		// 登录成功后一般会设置g_data.userInfo, 如果未设置，则当作未登录
		if (g_data.userInfo == null) {
			MUI.showLogin();
			return;
		}
		// 显示该页面...
	}

在pagebeforeshow事件中做页面切换，框架保证不会产生闪烁，且在新页面上点返回按钮，不会返回到旧页面。

除此之外如果多次调用showPage（包括在pageshow事件中调用），一般最终显示的是最后一次调用的页面，过程中可能产生闪烁，且可能会丢失一些pageshow/pagehide事件，应尽量避免。

### 页面路由

默认路由：

- 一般只用一级目录：`http://server/app/index.html#order`对应`{pageFolder=page}/order.html`，一般为`page/order.html`
- 也支持多级目录：`http://server/app/index.html#order-list`对应`page/order/list.html`
- 与筋斗云后端框架一起使用时，支持插件目录：`http://server/app/index.html#order-list`在存在插件'order'时，对应`{pluginFolder=../plugin}/order/m2/page/list.html`，一般为`../plugin/order/m2/page/list.html`

URL也可以显示为文件风格，比如在设置：

	<base href="./" mui-showHash="no">

之后，上面两个例子中，URL会显示为 `http://server/app/page/order.html` 和 `http://server/app/page/order/list.html`
@see MUI.options.showHash

特别地，还可以通过`MUI.setUrl(url)`或`MUI.showPage(pageRef, {url: url})`来定制URL，例如将订单id=100的逻辑页显示为RESTful风格：`http://server/app/order/100`
@see MUI.setUrl

为了刷新时仍能正常显示页面，应将页面设置为入口页，并在WEB服务器配置好URL重写规则。

## 服务端交互API

@see callSvr 系列调用服务端接口的方法。

## 登录与退出

框架提供MUI.showLogin/MUI.logout操作. 
调用MUI.tryAutoLogin可以支持自动登录.

登录后显示的主页，登录页，应用名称等应通过MUI.options.homePage/loginPage/appName等选项设置。

@see MUI.tryAutoLogin
@see MUI.showLogin
@see MUI.logout
@see MUI.options

## 常用组件

框架提供导航栏、对话框、弹出框、弹出菜单等常用组件。

### 导航栏

@key .mui-navbar 导航栏
@key .mui-navbar.noactive

默认行为是点击后添加active类（比如字体发生变化），如果不需要此行为，可再添加noactive类。

### 对话框

@key .mui-dialog 对话框

### 弹出菜单

@key .mui-menu 菜单

### 底部导航

@key #footer 底部导航栏

设置id为"footer"的导航, 框架会对此做些设置: 如果当前页面为导航栏中的一项时, 就会自动显示导航栏.
例: 在html中添加底部导航:

	<div id="footer">
		<a href="#home">订单</a>
		<a href="#me">我</a>
	</div>

如果要添加其它底部导航，可以用ft类加mui-navbar类，例如下例显示一个底部工具栏：

	<div class="ft mui-navbar noactive">
		<a href="javascript:;">添加</a>
		<a href="javascript:;">更新</a>
		<a href="javascript:;">删除</a>
	</div>

## 图片按需加载

仅当页面创建时才会加载。

	<img src="../m/images/ui/carwash.png">

## 原生应用支持

使用MUI框架的Web应用支持被安卓/苹果原生应用加载（通过cordova技术）。

设置说明：

- 在Web应用中指定正确的应用程序名(MUI.options.appName).
- App加载Web应用时在URL中添加cordova={ver}参数，就可自动加载cordova插件(m/cordova或m/cordova-ios目录下的cordova.js文件)，从而可以调用原生APP功能。
- 在App打包后，将apk包或ipa包其中的cordova.js/cordova_plugins.js/plugins文件或目录拷贝出来，合并到 cordova 或 cordova-ios目录下。
  其中，cordova_plugins.js文件应手工添加所需的插件，并根据应用名(MUI.options.appName)及版本(g_args.cordova)设置filter. 可通过 cordova.require("cordova/plugin_list") 查看应用究竟使用了哪些插件。
- 在部署Web应用时，建议所有cordova相关的文件合并成一个文件（通过Webcc打包）

不同的app大版本(通过URL参数cordova=?识别)或不同平台加载的插件是不一样的，要查看当前加载了哪些插件，可以在Web控制台中执行：

	cordova.require('cordova/plugin_list')

对原生应用的额外增强包括：

@key topic-splashScreen
@see MUI.options.manualSplash

- 应用加载完成后，自动隐藏启动画面(SplashScreen)。如果需要自行隐藏启动画面，可以设置

		MUI.options.manualSplash = true; // 可以放在H5应用的主js文件中，如index.js

	然后开发者自己加载完后隐藏SplashScreen:

		if (navigator.splashscreen && navigator.splashscreen.hide)
			navigator.splashscreen.hide();

@key topic-iosStatusBar
@see MUI.options.noHandleIosStatusBar

- ios7以上, 框架自动为顶部状态栏留出20px高度的空间. 默认为白色，可以修改类mui-container的样式，如改为黑色：

	.mui-container {
		background-color:black;
	}

如果使用了StatusBar插件, 可以取消该行为. 
先设置选项：

	MUI.options.noHandleIosStatusBar = true; // 可以放在H5应用的主js文件中，如index.js

然后在deviceready事件中自行设置样式, 如

	function muiInit() {
		$(document).on("deviceready", onSetStatusBar);
		function onSetStatusBar()
		{
			var bar = window.StatusBar;
			if (bar) {
				bar.styleLightContent();
				bar.backgroundColorByHexString("#ea8010");
			}
		}
	}

@key deviceready APP初始化后回调事件

APP初始化成功后，回调该事件。如果deviceready事件未被回调，则出现启动页无法消失、插件调用无效、退出程序时无提示等异常。
其可能的原因是：

- m/cordova/cordova.js文件版本不兼容，如创建插件cordova平台是5.0版本，而相应的cordova.js文件或接口文件版本不同。
- 在编译原生程序时未设置 <allow-navigation href="*">，或者html中CSP设置不正确。
- 主页中有跨域的script js文件无法下载。如 `<script type="text/javascript" src="http://3.3.3.3/1.js"></script>`
- 某插件的初始化过程失败（需要在原生环境下调试）

## 系统类标识

框架自动根据系统环境为应用容器(.mui-container类)增加以下常用类标识：

@key .mui-android 安卓系统
@key .mui-ios 苹果IOS系统
@key .mui-weixin 微信浏览器
@key .mui-cordova 原生环境

在css中可以利用它们做针对系统的特殊设置。

## 手势支持

如果使用了 jquery.touchSwipe 库，则默认支持手势：

- 右划：页面后退
- 左划：页面前进

@key mui-swipenav DOM属性
如果页面中某组件上的左右划与该功能冲突，可以设置属性mui-swipenav="no"来禁用该功能：

	<div mui-swipenav="no"></div>

@key .noSwipe CSS-class
左右划前进后退功能会导致横向滚动生效。可以通过添加noSwipe类（注意大小写）的方式禁用swipe事件恢复滚动功能：

	<div class="noSwipe"></div>

## 跨域前端开发支持

典型应用是, 在开发前端页面时, 本地无须运行任何后端服务器(如apache/iis/php等), 直接跨域连接远程接口进行开发.

支持直接在浏览器中打开html/js文件运行应用.
需要浏览器支持CORS相关设置. 以下以chrome为例介绍.
例如, 远程接口的基础URL地址为 http://oliveche.com/jdcloud/

- 为chrome安装可设置CORS的插件(例如ForceCORS), 并设置:

		添加URL: http://oliveche.com/*
		Access-Control-Allow-Origin: file://
		Access-Control-Allow-Credentials: true

- 打开chrome时设置参数 --allow-file-access-from-files 以允许ajax取本地文件.
- 在app.js中正确设置接口URL，如

		$.extend(MUI.options, {
			serverUrl: "http://oliveche.com/jdcloud/api.php"
			// serverUrlAc: "ac"
		});

这时直接在chrome中打开html文件即可连接远程接口运行起来.
 */
