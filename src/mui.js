jdModule("jdcloud.mui", JdcloudMui);
function JdcloudMui()
{
var self = this;
var mCommon = jdModule("jdcloud.common");

// 子模块
JdcloudApp.call(self);
JdcloudCall.call(self);
JdcloudMuiPage.call(self);

// ====== global {{{
/**
@var isBusy

标识应用当前是否正在与服务端交互。一般用于自动化测试。
也常用于防止重复提交，示例：

	jpage.find(".btnUpload").click(btnUpload_click);
	function btnUpload_click() {
		// 防止重复点击提交
		if (MUI.isBusy)
			return;
		callSvr("upload", ...);
	}
*/
self.isBusy = false;

/**
@var g_args

应用参数。

URL参数会自动加入该对象，例如URL为 `http://{server}/{app}/index.html?orderId=10&dscr=上门洗车`，则该对象有以下值：

	g_args.orderId=10; // 注意：如果参数是个数值，则自动转为数值类型，不再是字符串。
	g_args.dscr="上门洗车"; // 对字符串会自动进行URL解码。

框架会自动处理一些参数：

- g_args._debug: 在测试模式下，指定后台的调试等级，有效值为1-9. 参考：后端测试模式 P_TEST_MODE，调试等级 P_DEBUG.
- g_args.cordova: 用于在手机APP应用中加载H5应用，参考“原生应用支持”。示例：http://server/jdcloud/m2/index.html?cordova=1
- g_args.wxCode: 用于在微信小程序中加载H5应用，并自动登录。参考：options.enableWxLogin 微信认证登录
- g_args.enableSwitchApp: 允许多应用自动切换功能。参考：options.enableSwitchApp
- g_args.logout: 退出登录后再进入应用。示例：http://server/jdcloud/m2/index.html?logout

@see parseQuery URL参数通过该函数获取。
*/
window.g_args = {}; // {_debug, cordova}

/**
@var g_cordova

值是一个整数，默认为0. 可用它来判断WEB应用是否在APP容器中运行。
如果非0，表示WEB应用在苹果或安卓APP中运行，且数值代表原生应用容器的版本号。

示例：检查用户APP版本是否可以使用某些插件。

	if (g_cordova) { // 在原生APP中。可以使用插件。
		// 假如在IOS应用的大版本3中，加入了某插件，如果用户未升级，可提示他升级：
		if (g_cordova < 3 && isIOS()) {
			app_alert("您的版本太旧，XX功能无法使用，请升级到最新版本");
		}
	}

WEB应用容器应在URL中传递cordova参数，表示容器版本号。该版本号会保存在ApiLog的ver字段中。

如果容器不支持上述约定，可在WEB应用初始化时设置g_cordova变量来做兼容，示例：

	// UserAgent for infiniti app
	// android example: Mozilla/5.0 ... AppVersion/1.2.4 ... AppName/dafengche+infiniti
	// iphone example: Mozilla/5.0 ... Souche/Dafengche/spartner/infiniti/InfinitiInhouse/1.2.4
	function initApp() {
		var ua = navigator.userAgent;
		var m;
		if ((m = ua.match(/android.*appversion\/([\d.]+)/i)) || (m = ua.match(/iphone.*infinitiInhouse\/([\d.]+)/i))) {
			MUI.options.appName = "emp-m";
			var ver = m[1];
			if (m = ver.match(/(\d+)\.(\d+)\.(\d+)/)) {
				window.g_cordova = parseInt(m[1]) * 10000 + parseInt(m[2]) * 100 + parseInt(m[3]);
			}
		}
	}
	initApp();

@see 原生应用支持
*/
window.g_cordova = 0; // the version for the android/ios native cient. 0 means web app.

/**
@var g_data = {userInfo?, serverRev?, initClient?}

应用全局共享数据。

在登录时，会自动设置userInfo属性为个人信息。所以可以通过 g_data.userInfo==null 来判断是否已登录。

serverRev用于标识服务端版本，如果服务端版本升级，则应用可以实时刷新以更新到最新版本。

@key g_data.userInfo
@key g_data.serverRev
@key g_data.initClient
应用初始化时，调用initClient接口得到的返回值，通常为{plugins, ...}

@key g_data.testMode,g_data.mockMode 测试模式和模拟模式

TODO: MUI.data
*/
window.g_data = {}; // {userInfo, serverRev?, initClient?, testMode?, mockMode?}

//}}}

/**
@var options

可用的选项如下。

@var options.appName?=user  应用名称

用于与后端通讯时标识app.

@var options.loginPage?="#login"  login逻辑页面的地址
@var options.homePage?="#home"  首页地址
@var options.pageFolder?="page" 逻辑页面文件(html及js)所在文件夹

@var options.statusBarColor?="#,light" 设置状态栏颜色，默认为应用程序背景色和白字。
@see topic-iosStatusBar
（版本v5.0）

利用statusbar插件设置标题栏。
其中背景设置使用"#000"或"#000000"这种形式，特别地，只用"#"可表示使用当前应用程序的背景色（.mui-container背景颜色）。
前景设置使用"light"(白色)或"dark"(黑色)。
设置为"none"表示隐藏标题栏。
设置为空("")表示禁止框架设置状态栏。

@var options.fixTopbarColor?=false

如果为true, 则自动根据页面第一个hd的背景色设置手机顶栏颜色.
适合每个页面头部颜色不同的情况. 更复杂的情况, 可使用`MUI.setTopbarColor`手工设置顶栏颜色.

@var options.manualSplash?=false
@see topic-splashScreen

@var options.logAction?=false  Boolean. 是否显示详细日志。
可用于交互调用的监控。

@var options.PAGE_SZ?=20  分页大小，下拉列表每次取数据的缺省条数。

@var options.mockDelay?=50  模拟调用后端接口的延迟时间，单位：毫秒。仅对异步调用有效。

@see mockData 模拟调用后端接口

@var options.serverUrl?="./"  服务端接口地址设置。
@var options.serverUrlAc  表示接口名称的URL参数。

示例：

	$.extend(MUI.options, {
		serverUrl: "http://myserver/myapp/api.php",
		serverUrlAc: "ac"
	});

接口"getuser(id=10)"的HTTP请求为：

	http://myserver/myapp/api.php?ac=getuser&id=10
	
如果不设置serverUrlAc（默认为空），则HTTP请求为：

	http://myserver/myapp/api.php/getuser?id=10

支持上面这种URL的服务端，一般配置过pathinfo机制。
再进一步，如果服务端设置了rewrite规则可以隐藏api.php，则可设置：

	$.extend(MUI.options, {
		serverUrl: "http://myserver/myapp/", // 最后加一个"/"
	});

这样发起的HTTP请求为：

	http://myserver/myapp/getuser?id=10

@var options.pluginFolder?="../plugin" 指定筋斗云插件目录

筋斗云插件提供具有独立接口的应用功能模块，包括前端、后端实现。

@var options.showHash?=true

默认访问逻辑页面时，URL地址栏显示为: "index.html#me"

只读，如果值为false, 则地址栏显示为: "index.html/page/me.html".

注意：该选项不可通过js设置为false，而应在主页面中设置：

	<base href="./" mui-showHash="no">

在showHash=false时，必须设置base标签, 否则逻辑页将无法加载。

@var options.disableFastClick?=false

在IOS+cordova环境下，点击事件会有300ms延迟，默认会加载lib/fastclick.min.js解决。

该库会导致部分场景下点击失效问题。这时可以通过在关键点击元素上设置"needsclick"类来解决。

例如：fastclick库与图片裁切库image-process-tool有些冲突, ios手机APP中点修改头像无法弹出图片选择框. JS初始化配置如下：

	var zxImageProcess = new ZxImageProcess({
		// 触发文件选择的元素
		selector: jpage.find(".downSelect-btn[value=1]")[0],
		...
	});

最终将绑定用于点击的元素 `<div class='downSelect-btn'></div>`改为 `<div class='downSelect-btn needsclick'></div>`解决。
发现IOS上点击失效问题，可先设置`options.disableFastClick=true`检查问题是否消失来判定。

TODO: cordova-ios未来将使用WkWebView作为容器（目前仍使用UIWebView），将不再有点击延迟问题，到时将去除FastClick库。

@var options.onAutoLogin 自动登录
@event autoLogin 自动登录事件(v5.4)

设置如何自动登录系统，进入应用后，一般会调用tryAutoLogin，其中会先尝试重用已有会话，如果当前没有会话则回调onAutoLogin自动登录系统。
返回true则跳过后面系统默认的登录过程，包括使用本地保存的token自动登录以及调用login接口。

一般用于微信认证后绑定用户身份，示例：

	$.extend(MUI.options, {
		...
		onAutoLogin: onAutoLogin
	});

	function onAutoLogin()
	{
		// 发起微信认证
		var param = {state: location.href};
		location.href = "../weixin/auth.php?" + $.param(param);
		// 修改了URL后直接跳出即可。不用返回true
		MUI.app_abort();
	}

(v5.4)也可以用autoLogin事件：

	$(document).on("autoLogin", onAutoLogin);

@var options.enableWxLogin 微信认证登录

设置enableWxLogin为true，或者appName为"user"，则如果URL中有参数wxCode, 就调用后端"login2(wxCode)"接口登录认证。
一般用于从微信小程序调用H5应用。
要求后端已实现login2接口。

	$.extend(MUI.options, {
		...
		enableWxLogin: true
	});

@var options.enableSwitchApp 自动保存和切换应用
@key g_args.enableSwitchApp =1 应用自动切换

同一个目录下的多个应用，支持自动切换。
例如原生APP（或微信小程序中）的URL为用户端，但在登录页或个人中心页可切换到员工端。
当进入员工端并登录成功后，希望下次打开APP后直接进入员工端，做法如下：

在H5应用中设置选项options.enableSwitchApp=true。(例如在app.js中设置，这样所有应用都允许跳转）
应用登录后将自动记录当前URL。

在APP中初次打开H5应用(history.length<=1)时，会在进入应用后自动检查和切换应用（将在MUI.validateEntry函数中检查，一般H5应用的主JS文件入口处默认会调用它）。
最好在URL中添加参数enableSwitchApp=1强制检查，例如在chrome中初次打开页面history.length为2，不加参数就无法自动切换H5应用。

@var options.onShowPage(pageRef, opt) 显示页面前回调

(v5.4) 在调用MUI.showPage时触发调用，参数与MUI.showPage相同，用于显示任何页面前通用的操作。
此回调在页面加载或显示之前（先于目的页面的pagecreate/pagebeforeshow等事件）。
如果返回false，则取消本次showPage调用。

示例1：允许用户未登录使用，但除了home页面，进入其它页面均要求登录。
注意：系统默认要求登录才能进入，若要修改，可在muiInit事件中修改调用`MUI.tryAutoLogin(..., allowNoLogin=true)`来实现允许未登录进入。
此需求如果放在每个页面的pagebeforeshow中处理则非常麻烦，可在onShowPage中统一处理。

	$.extend(MUI.options, {
		...
		onShowPage: onShowPage
	});

	...
	// MUI.tryAutoLogin(handleLogin, "User.get");
	MUI.tryAutoLogin(handleLogin, "User.get", true); // 允许未登录进入。

	// 如果未登录，跳转login。
	function onShowPage(pageRef, opt) {
		if (pageRef == "#home" || pageRef == "#setUserInfo" || pageRef.substr(0, 6) == "#login")
			return;

		// 如果是未登录进入，则跳转登录页。
		if (!g_data.userInfo) {
			MUI.showLogin();
			return false;
		}
	}

示例2：接上例，当系统在微信中使用时，允许用户使用微信身份自动登录，并可以查看home页面。
但如果用户尚未绑定过手机号，在进入其它页面时，必须先绑定手机号。

	$.extend(MUI.options, {
		...
		onShowPage: onShowPage
	});

	// 如果手机号没有填写，则要求填写并返回false。
	function onShowPage(pageRef, opt) {
		if (pageRef == "#home" || pageRef == "#setUserInfo" || pageRef.substr(0, 6) == "#login")
			return;

		// 如果是未登录进入，则跳转登录页。
		if (!g_data.userInfo) {
			MUI.showLogin(pageRef);
			return false;
		}
		if (g_data.userInfo && !g_data.userInfo.phone) {
			PageSetUserInfo.userInit = true;
			PageSetUserInfo.fromPageRef = pageRef;
			MUI.showPage("#setUserInfo");
			return false;
		}
	}

@var options.showLoadingDelay ?= 500  延迟显示加载图标

(v5.4) 默认如果在500ms内如果远程调用成功, 则不显示加载图标.


@var options.skipErrorRegex 定义要忽略的错误

示例：有video标签时，缩小窗口或全屏预览时，有时会报一个错（见下例），暂不清楚解决方案，也不影响执行，可以先安全忽略它不要报错：

	$.extend(MUI.options, {
		skipErrorRegex: /ResizeObserver loop limit exceeded/i,
	});

@var options.allowNoLogin(page)  (v6) 返回页面是否需要登录的函数

示例："hello"页面或"test"开头的页面无须登录可直接打开：

	MUI.options.allowNoLogin = function (page) {
		return page == "hello" || /^test/.test(page);
	}

*/
	var m_opt = self.options = {
		appName: "user",
		loginPage: "#login",
		homePage: "#home",
		pageFolder: "page",
		serverUrl: "./",

		logAction: false,
		PAGE_SZ: 20,
		manualSplash: false,
		mockDelay: 50,
		showLoadingDelay: 500,

		pluginFolder: "../plugin",
		showHash: ($("base").attr("mui-showHash") != "no"),
		statusBarColor: "#,light",

		skipErrorRegex: null,

/**
@var MUI.options.moduleExt

用于模块扩展。

	// 定制模块的接口调用地址
	MUI.options.moduleExt.callSvr = function (name) {
		// name为callSvr调用的接口名，返回实际URL地址；示例：
		var map = {
			"Ordr__Mes.query" => "../../mes/api/Ordr.query",
			"Ordr__Item.query" => "../../mes/api/Item.query"
		}
		return map[name] || name;
	}

详细用法案例，可参考：筋斗云开发实例讲解 - 系统复用与微服务方案。
*/
		moduleExt: {},

/**
@var MUI.options.xparam

参数加密特性。默认为1（开启），在后端接口返回当前是测试模式时，会改为0（关闭）。
也可以在chrome控制台中直接修改，如`MUI.options.xparam=0`。
 */
		xparam: 1,

/**
@var MUI.options.useNewThumb

带缩略图的图片编号保存风格。

- 0: 保存小图编号，用att(id)取小图，用att(thumbId)取大图
- 1: 保存大图编号，用att(id,thumb=1)取小图，用att(id)取大图
 */
		useNewThumb: 0
	};

	var m_onLoginOK;
	var m_allowedEntries;

// ---- 通用事件 {{{
function document_pageCreate(ev)
{
	var jpage = $(ev.target);

	var jhdr = jpage.find("> .hd");
	// 标题栏空白处点击5次, 进入测试模式; 注意避免子元素bubble导致的事件
	self.doSpecial(jhdr, "H1,H2", switchTestMode);
}

$(document).on("pagecreate", document_pageCreate);

/**
@fn setFormSubmit(jf, fn?, opt?={validate?, onNoAction?})

@param fn Function(data); 与callSvr时的回调相同，data为服务器返回的数据。
函数中可以使用this["userPost"] 来获取post参数。

@param opt.validate: Function(jf, queryParam={ac?,...}). 
如果返回false, 则取消submit. queryParam为调用参数，可以修改。
(v5.3) 支持异步提交，返回Deferred对象时，表示在Deferred.resolve之后再提交。

form提交时的调用参数, 如果不指定, 则以form的action属性作为queryParam.ac发起callSvr调用.
form提交时的POST参数，由带name属性且不带disabled属性的组件决定, 可在validate回调中设置．

设置POST参数时，固定参数可以用`<input type="hidden">`标签来设置，自动计算的参数可以先放置一个隐藏的input组件，然后在validate回调中来设置。
示例：

	<form action="fn1">
		<input name="name" value="">
		<input name="type" value="" style="display:none">
		<input type="hidden" name="wantAll" value="1">
	</form>

	MUI.setFormSubmit(jf, api_fn1, {
		validate: function(jf, queryParam) {
			// 检查字段合法性
			if (! isValidName(jf[0].name.value)) {
				app_alert("bad name");
				return false;
			}
			// 设置GET参数字段"cond"示例
			queryParam.cond = "id=1";

			// 设置POST参数字段"type"示例
			jf[0].type.value = ...;
		}
	});

如果之前调用过setFormData(jo, data, {setOrigin:true})来展示数据, 则提交时，只会提交被修改过的字段，否则提交所有字段。

@param opt.onNoAction: Function(jf). 当form中数据没有变化时, 不做提交. 这时可调用该回调函数.

(v5.3)
异步提交示例：点击提交后，先上传照片，照片传完获取到picId，然后做之后提交动作

	MUI.setFormSubmit(jf, api_fn1, {
		validate: function(jf, queryParam) {
			var dfd = $.Deferred();
			uploadPic.submit().then(function (picId) {
				jf[0].picId.value = picId;
				dfd.resolve();
			});
			return dfd;
		}
	});

*/
self.setFormSubmit = setFormSubmit;
function setFormSubmit(jf, fn, opt)
{
	opt = opt || {};
	jf.submit(function (ev) {
		ev.preventDefault();
		// 防止重复点击提交
		if (self.isBusy)
			return;

		var queryParam = {ac: jf.attr("action")};
		if (opt.validate) {
			var ret = opt.validate(jf, queryParam);
			if (false === ret)
				return false;
			// 异步支持
			if (ret && ret.then) {
				ret.then(doSubmit);
				return false;
			}
		}
		doSubmit();
		return false;

		function doSubmit() {
			var postParam = mCommon.getFormData(jf);
			if (! $.isEmptyObject(postParam)) {
				var ac = queryParam.ac;
				delete queryParam.ac;
				self.callSvr(ac, queryParam, fn, postParam, {userPost: postParam});
			}
			else if (opt.onNoAction) {
				opt.onNoAction(jf);
			}
		}
	});
}
//}}}

// ------ cordova setup {{{
$(document).on("deviceready", function () {
	var homePageId = m_opt.homePage.substr(1); // "#home"
	// 在home页按返回键退出应用。
	$(document).on("backbutton", function () {
		if (self.activePage.attr("id") == homePageId) {
			self.app_alert("退出应用?", 'q', function () {
				navigator.app.exitApp();
			}, {keep:true});
			return;
		}
		history.back();
	});

	$(document).on("menubutton", function () {
	});

	if (!m_opt.manualSplash && navigator.splashscreen && navigator.splashscreen.hide)
	{
		// 成功加载后稍等一会(避免闪烁)后隐藏启动图
		$(function () {
			setTimeout(function () {
				navigator.splashscreen.hide();
			}, 500);
		});
	}

	if (m_opt.statusBarColor && window.StatusBar) {
		var bar = window.StatusBar;
		var str = m_opt.statusBarColor;
		if (str == "none") {
			bar.hide();
		}
		else {
			var ms = str.match(/(#\w*)/);
			if (ms) {
				var color = ms[1];
				if (color == '#')
					color = mCommon.rgb2hex( $(".mui-container").css("backgroundColor") );
				bar.backgroundColorByHexString(color);
			}
			ms = str.match(/\b(dark|light)\b/);
			if (ms) {
				if (ms[1] == 'dark')
					bar.styleDefault();
				else
					bar.styleLightContent();
			}
		}
		if (m_opt.fixTopbarColor) {
			fixTopbarColor();
		}
		if (mCommon.isIOS()) {
			// bugfix: IOS上显示statusbar时可能窗口大小不正确
			bar.overlaysWebView(false);
			setTimeout(function () {
				$(window).trigger("resize");
			});
		}
	}
});


/**
@fn MUI.setTopbarColor(colorHex, style?)

@param colorHex 颜色值,格式如 "#fafafa", 可用MUI.rgb2hex函数转换.
@param style dark|light

设置顶栏颜色和字体黑白风格.
*/
self.setTopbarColor = setTopbarColor;
function setTopbarColor(colorHex, style)
{
	var bar = window.StatusBar;
	if (g_cordova && bar && colorHex) {
		bar.backgroundColorByHexString(colorHex);
		if (style) {
			if (style === "dark")
				bar.styleDefault();
			else if (style === "light")
				bar.styleLightContent();
		}
		self.options.statusBarColor = colorHex;
	}
}

/**
@fn fixTopbarColor()

用于原生应用，让顶栏颜色与页面hd部分的颜色自动保持一致。
 */
self.fixTopbarColor = fixTopbarColor;
function fixTopbarColor()
{
	if (!g_cordova)
		return;
	$(document).on("pageshow", onPageShow);
	onPageShow();
	
	function onPageShow() {
		var color = MUI.activePage.find(".hd").css("backgroundColor"); // format: "rgb(...)"
		if (color) {
			var colorHex = self.rgb2hex(color); // call rgb(...)
			setTopbarColor(colorHex);
		}
	}
}

//}}}

// ------ enter and exit {{{
// 所有登录页都应以app.loginPage指定内容作为前缀，如loginPage="#login", 
// 则登录页面名称可以为：#login, #login1, #loginByPwd等
function isLoginPage(pageRef)
{
	if (/^\w/.test(pageRef)) {
		pageRef = "#" + pageRef;
	}
	if (pageRef.indexOf(m_opt.loginPage) != 0)
		return false;
	return true;
}

// page: pageRef/jpage/null
// return: page对应的pageRef, null表示home页面, 
function getPageRef(page)
{
	var pageRef = page;
	if (page == null) {
		if (self.activePage) {
			pageRef = "#" + self.activePage.attr("id");
		}
		else {
			// only before jquery mobile inits
			// back to this page after login:
			pageRef = location.hash || null;
		}
	}
	else if (page instanceof jQuery) {
		pageRef = "#" + page.attr("id");
	}
	else if (page === "#" || page === "") {
		pageRef = null;
	}
	return pageRef;
}

/**
@fn showLogin(page?)
@param page=pageRef/jpage 如果指定, 则登录成功后转向该页面; 否则转向登录前所在的页面.

显示登录页. 注意: 登录页地址通过MUI.options.loginPage指定, 缺省为"#login".

	<div data-role="page" id="login">
	...
	</div>

注意：

- 登录成功后，会自动将login页面清除出页面栈，所以登录成功后，点返回键，不会回到登录页。
- 如果有多个登录页（如动态验证码登录，用户名密码登录等），其它页的id起名时，应以app.loginPage指定内容作为前缀，
  如loginPage="#login", 则登录页面名称可以为：#login(缺省登录页), #login1, #loginByPwd等；否则无法被识别为登录页，导致登录成功后按返回键仍会回到登录页

*/
self.showLogin = showLogin;
function showLogin(page)
{
	var pageRef = getPageRef(page);
	if (isLoginPage(pageRef))
		return;
	m_onLoginOK = function () {
		// 如果当前仍在login系列页面上，则跳到指定页面。这样可以在handleLogin中用MUI.showPage手工指定跳转页面。
		if (MUI.activePage && isLoginPage(MUI.getToPageId())) {
			if (pageRef == null || isLoginPage(pageRef))
				pageRef = m_opt.homePage;
			MUI.showPage(pageRef);
		}
	}
	MUI.showPage(m_opt.loginPage);
}

/**
@fn showHome()

显示主页。主页是通过 MUI.options.homePage 来指定的，默认为"#home".

要取主页名可以用：

	var jpage = $(MUI.options.homePage);

@see options.homePage
*/
self.showHome = showHome;
function showHome()
{
	self.showPage(m_opt.homePage);
}

/**
@fn logout(dontReload?)
@param dontReload 如果非0, 则注销后不刷新页面.

注销当前登录, 成功后刷新页面(除非指定dontReload=1)
*/
self.logout = logout;
function logout(dontReload)
{
	deleteLoginToken();
	g_data.userInfo = null;
	self.callSvr("logout", function () {
		if (! dontReload)
			mCommon.reloadSite();
	});
}

// 取H5应用的页面名。 e.g. "/jdcloud/m2/index.html" -> "index.html"
function getAppPage()
{
	var url = location.pathname.replace(/.*\/+/, '');
	if (url == "") {
		url = "index.html"
	}
	return url;
}

/**
@fn validateEntry(@allowedEntries) 入口页检查

设置入口页，allowedEntries是一个数组, 如果初始页面不在该数组中, 则URL中输入该逻辑页时，会自动转向主页。

示例：

	MUI.validateEntry([
		"#home",
		"#me",
		/^#udt__/  # (v5.3) 支持正则式
	]);

*/
self.validateEntry = validateEntry;
// check if the entry is in the entry list. if not, refresh the page without search query (?xx) or hash (#xx)
function validateEntry(allowedEntries)
{
	// 自动切换APP
	if (self.options.enableSwitchApp && (history.length <= 1 || g_args.enableSwitchApp)) {
		var appPage0 = mCommon.getStorage("appPage")
		if (appPage0) {
			var appPage = getAppPage();
			if (appPage != appPage0) {
				location.href = appPage0;
				self.app_abort();
			}
		}
	}

	if (allowedEntries == null)
		return;
	m_allowedEntries = allowedEntries;

	if (location.hash && location.hash != "#" && !isAllowed()) {
		location.href = location.pathname; // remove search and hash like "?k=v#page1"
		self.app_abort();
	}

	function isAllowed() {
		var found = false;
		//var hash = decodeURIComponent(location.hash);
		var hash = location.hash;
		if (isAllowNoLogin(hash))
			return true;
		$.each(allowedEntries, function () {
			if ( (this instanceof RegExp && this.test(hash)) || this == hash) {
				found = true;
				return false;
			}
		});
		return found;
	}
}

// set g_args
function parseArgs()
{
	if (location.search)
		g_args = mCommon.parseQuery(location.search.substr(1));

	if (g_args.cordova || mCommon.getStorage("cordova")) {
		if (g_args.cordova === 0) {
			mCommon.delStorage("cordova");
		}
		else {
			g_cordova = parseInt(g_args.cordova || mCommon.getStorage("cordova"));
			g_args.cordova = g_cordova;
			mCommon.setStorage("cordova", g_cordova);
			$(function () {
				var path = './';
				if (/iPhone|iPad|Macintosh/i.test(navigator.userAgent)) {
					if (g_args.mergeJs) {
						mCommon.loadScript(path + "lib-cordova-ios.min.js"); 
					}
					else {
						mCommon.loadScript(path + "cordova-ios/cordova.js?__HASH__,.."); 
					}

					if (! m_opt.disableFastClick) {
						// introduce fastclick for IOS webview: https://github.com/ftlabs/fastclick
						mCommon.loadScript(path + "lib/fastclick.min.js").then(function () {
							Origami.fastclick(document.body);
						});
					}
				}
				else {
					if (g_args.mergeJs) {
						mCommon.loadScript(path + "lib-cordova.min.js"); 
					}
					else {
						mCommon.loadScript(path + "cordova/cordova.js?__HASH__,.."); 
					}
				}
			});
		}
	}
}
parseArgs();

// ---- login token for auto login {{{
function tokenName()
{
	var name = "token";
	if (m_opt.appName)
		name += "_" + m_opt.appName;
	return name;
}

function saveLoginToken(data)
{
	if (data._token)
	{
		mCommon.setStorage(tokenName(), data._token);
	}
}

function loadLoginToken()
{
	return mCommon.getStorage(tokenName());
}

function deleteLoginToken()
{
	mCommon.delStorage(tokenName());
}

/**
@fn tryAutoLogin(onHandleLogin, reuseCmd?, allowNoLogin?=false)

尝试自动登录，如果失败则转到登录页（除非allowNoLogin=true）。

@param onHandleLogin Function(data). 调用后台login()成功后的回调函数(里面使用this为ajax options); 可以直接使用MUI.handleLogin
@param reuseCmd String. 当session存在时替代后台login()操作的API, 如"User.get", "Employee.get"等, 它们在已登录时返回与login相兼容的数据. 因为login操作比较重, 使用它们可减轻服务器压力. 
@param allowNoLogin Boolean. 缺省未登录时会自动跳转登录页面, 如果设置为true, 如不会自动跳转登录框, 表示该应用允许未登录时使用.
@return Boolean. true=登录成功; false=登录失败.

该函数应该在muiInit事件中执行, 以避免框架页面打开主页。

	$(document).on("muiInit", myInit);

	function myInit()
	{
		// redirect to login if auto login fails
		MUI.tryAutoLogin(handleLogin, "User.get");
	}

	function handleLogin(data)
	{
		MUI.handleLogin(data);
		// g_data.userInfo已赋值
	}

打开首页面逻辑：

- 入口检查（MUI.validateEntry函数）：如果当前页面是免登录页面（通过MUI.options.allowNoLogin函数判定）或本身就是登录页，直接打开；
  否则如果不是入口页则自动改为主页，然后重新进入。
- 如果尚未登录过（或会话已过期）：
	- 如果当前非登录页，则自动跳转登录页，且登录成功后跳转回当前页；
	- 如果当前是登录页，则不跳转，登录成功后进入主页
- 如果已登录
	- 如果当前非登录页，直接打开
	- 如果当前是登录页，则进入主页
- 进入系统后点返回，不会回到登录页

*/
self.tryAutoLogin = tryAutoLogin;
function tryAutoLogin(onHandleLogin, reuseCmd, allowNoLogin)
{
	var ok = false;
	var ajaxOpt = {async: false, noex: true};

	function handleAutoLogin(data)
	{
		if (data === false) // has exception (as noex=true)
			return;

		g_data.userInfo = data;
		if (onHandleLogin)
			onHandleLogin.call(this, data);
		ok = true;
	}

	if (g_args.wxCode && (self.options.enableWxLogin || self.options.appName == "user")) {
		console.log("login via wxCode. href=" + location.href);
		self.callSvr("login2", {wxCode: g_args.wxCode}, handleAutoLogin, null, ajaxOpt);
		self.deleteUrlParam("wxCode");
		if (ok)
			return ok;
	}

	// first try "User.get"
	if (reuseCmd != null) {
		self.callSvr(reuseCmd, handleAutoLogin, null, ajaxOpt);
	}
	if (ok)
		return ok;
	if ($.isFunction(self.options.onAutoLogin)) {
		if (self.options.onAutoLogin() === true)
			return true;
	}
	$(document).trigger("autoLogin");

	// then use "login(token)"
	var token = loadLoginToken();
	if (token != null)
	{
		var param = {};
		var postData = {token: token};
		self.callSvr("login", param, handleAutoLogin, postData, ajaxOpt);
	}
	if (ok)
		return ok;

	if (! (allowNoLogin || isAllowNoLogin()) )
	{
		self.showFirstPage = false;
		showLogin();
	}
	return ok;
}

// page?=location.hash
function isAllowNoLogin(page)
{
	if (page == null)
		page = location.hash;
	if (page[0] == '#')
		page = page.substr(1);

	return isLoginPage(page) || (self.options.allowNoLogin && self.options.allowNoLogin(page));
}

/**
@fn handleLogin(data)
@param data 调用API "login"成功后的返回数据.

处理login相关的操作, 如设置g_data.userInfo, 保存自动登录的token等等.
可以根据用户属性在此处定制home页，例如：

	if(role == "SA"){
		MUI.options.homePage = "#sa-home";
	}
	else if (role == "MA") {
		MUI.options.homePage = "#ma-home";
	}

@var dfdLogin

(v6) 用于在登录完成状态下执行操作的Deferred/Promise对象。
示例：若未登录，则在登录后显示消息；若已登录则直接显示消息

	WUI.dfdLogin.then(function () {
		app_show("hello");
	});

*/
self.handleLogin = handleLogin;
self.dfdLogin = $.Deferred();
function handleLogin(data)
{
	saveLoginToken(data);
	if (data.id == null)
		return;
	g_data.userInfo = data;

	if (self.options.enableSwitchApp) {
		mCommon.setStorage("appPage", getAppPage());
	}

	// 登录成功后点返回，避免出现login页
	var popN = 0;
	self.m_pageStack.walk(function (state) {
		if (! isLoginPage(state.pageRef))
			return false;
		++ popN;
	});
	if (popN > 0)
		self.popPageStack(popN);

	self.dfdLogin.resolve();
	if (m_onLoginOK) {
		var fn = m_onLoginOK;
		m_onLoginOK = null;
		setTimeout(fn);
	}
	else if (isLoginPage(location.hash)) {
		MUI.showHome();
	}
}
//}}}

// === language {{{
/**
@var LANG 多国语言支持/翻译

系统支持通过URL参数lang指定语言，如指定英文版本：`http://myserver/myapp/m2/index.html?lang=en`

如果未指定lang参数，则根据html的lang属性来确定语言，如指定英文版：

	<html lang="en">

默认为开发语言(lang="dev")，以中文为主。英文版下若想切换到开发语言，可以用`http://myserver/myapp/m2/index.html?lang=dev`
g_args.lang中保存着实际使用的语言。

自带英文语言翻译文件lib/lang-en.js，当lang=en时加载它。可扩展它或以它为模板创建其它语言翻译文件。
语言翻译文件中，设置全局变量LANG，将开发语言翻译为其它语言。

系统会自动为菜单项、页面标题、列表表头标题、对话框标题等查找翻译。
其它DOM组件若想支持翻译，可手工添加CSS类lang，如:

	<div><label class="lang"><input type="checkbox" value="mgr">最高管理员</label></div>

	<a href="javascript:logout()" class="logout"><span class="lang"><i class="icon-exit"></i>退出系统</span></a>

或在代码中，使用WUI.enhanceLang(jo)来为DOM组件支持翻译，或直接用T(str)翻译字符串。
注意lang类或enhanceLang函数不能设置组件下子组件的文字，可先取到文字组件再设置如`WUI.enhanceLang(jo.find(".title"))`。

@fn T(s) 字符串翻译

T函数用于将开发语言翻译为当前使用的语言。

@key .lang DOM组件支持翻译
@fn enhanceLang(jo) DOM组件支持翻译

 */
function T(s) {
	if (s == null || LANG == null)
		return s;
	return LANG[s] || s;
}

function initLang() {
	window.LANG = null;
	window.T = T;
	if (!g_args.lang)
		g_args.lang = document.documentElement.lang || 'dev';
	if (g_args.lang != 'dev') {
		mCommon.loadScript("lib/lang-" + g_args.lang + ".js", {async: false});
		//mCommon.loadScript("lib/easyui/locale/easyui-lang-en.js");
	}
	else {
		//mCommon.loadScript("lib/easyui/locale/easyui-lang-zh_CN.js");
	}
}

self.m_enhanceFn[".lang"] = self.enhanceLang = enhanceLang;
function enhanceLang(jo)
{
	if (LANG == null)
		return;
	jo.contents().each(function () {
		if (this.nodeType == 3) { // text
			var t = T(this.nodeValue);
			this.nodeValue = t;
		}
	});
}
// }}}

//}}}

// ------ plugins {{{
/**
@fn initClient(param?)
*/
self.initClient = initClient;
var plugins_ = {};
function initClient(param)
{
	self.callSvrSync('initClient', param, function (data) {
		g_data.initClient = data;
		plugins_ = data.plugins || {};
		$.each(plugins_, function (k, e) {
			if (e.js) {
				// "plugin/{pluginName}/{plugin}.js"
				var js = m_opt.pluginFolder + '/' + k + '/' + e.js;
				mCommon.loadScript(js, {async: true});
			}
		});
	});
}

/**
@class Plugins
*/
window.Plugins = {
/**
@fn Plugins.exists(pluginName)
*/
	exists: function (pname) {
		return plugins_[pname] !== undefined;
	},

/**
@fn Plugins.list()
*/
	list: function () {
		return plugins_;
	}
};
//}}}

// ------ main {{{
// 标题栏单击5次召唤
function switchTestMode()
{
	var url = prompt("切换URL?", location.href);
	if (url == null || url === "")
		return;
	if (url == location.href) {
		MUI.reloadPage();
		return;
	}
	if (url[0] == "/") {
		url = "http://" + url;
	}
	location.href = url;
	self.app_abort();
}

function main()
{
	var jc = self.container;
	if (mCommon.isIOS()) {
		jc.addClass("mui-ios");
	}
	else if (mCommon.isAndroid()) {
		jc.addClass("mui-android");
	}

	if (g_cordova) {
		jc.addClass("mui-cordova");
	}
	if (mCommon.isWeixin()) {
		jc.addClass("mui-weixin");
	}
	console.log(jc.attr("class"));
}

$(main);
//}}}

/**
@fn filterCordovaModule(module)

原生插件与WEB接口版本匹配。
在cordova_plugins.js中使用，用于根据APP版本与当前应用标识，过滤当前Web可用的插件。

例如，从客户端（应用标识为user）版本2.0，商户端（应用标识为store）版本3.0开始，添加插件 geolocation，可配置filter如下：

	module.exports = [
		...
		{
			"file": "plugins/cordova-plugin-geolocation/www/android/geolocation.js",
			"id": "cordova-plugin-geolocation.geolocation",
			"clobbers": [
				"navigator.geolocation"
			],
			"filter": [ ["user",2], ["store",3] ] // 添加filter
		}
	];

	filterCordovaModule(module); // 过滤模块

配置后，尽管WEB已更新，但旧版本应用程序不会具有该接口。

filter格式: [ [app1, minVer?=1, maxVer?=9999], ...], 仅当app匹配且版本在minVer/maxVer之间才使用
如果未指定filter, 表示总是使用
app标识由应用定义，常用如: "user"-客户端;"store"-商户端

*/
self.filterCordovaModule = filterCordovaModule;
function filterCordovaModule(module)
{
	var plugins = module.exports;
	module.exports = [];

	var app = (window.g_args && MUI.options.appName) || 'user';
	var ver = (window.g_args && g_args.cordova) || 1;
	plugins.forEach(function (e) {
		var yes = 0;
		if (e.filter) {
			e.filter.forEach(function (f) {
				if (app == f[0] && ver >= (f[1] || 1) && ver <= (f[2] || 9999)) {
					yes = 1;
					return false;
				}
			});
		}
		else {
			yes = 1;
		}
		if (yes)
			module.exports.push(e);
	});
	if (plugins.metadata)
		module.exports.metadata = plugins.metadata;
}

/**
@fn formatField(obj) -> obj

对obj中的以字符串表示的currency/date等类型进行转换。
判断类型的依据是属性名字，如以Tm结尾的属性（也允许带数字后缀）为日期属性，如"tm", "tm2", "createTm"都会被当作日期类型转换。

注意：它将直接修改传入的obj，并最终返回该对象。

	obj = {id: 1, amount: "15.0000", payAmount: "10.0000", createTm: "2016-01-11 11:00:00"}
	var order = MUI.formatField(obj); // obj会被修改，最终与order相同
	// order = {id: 1, amount: 15, payAmount: 10, createTm: (datetime类型)}
*/
var RE_CurrencyField = /(?:^(?:amount|price|total|qty)|(?:Amount|Price|Total|Qty))\d*$/;
var RE_DateField = /(?:^(?:dt|tm)|(?:Dt|Tm))\d*$/;
self.formatField = formatField;
function formatField(obj)
{
	for (var k in obj) {
		if (obj[k] == null || typeof obj[k] !== 'string')
			continue;
		if (RE_DateField.test(k))
			obj[k] = mCommon.parseDate(obj[k]);
		else if (RE_CurrencyField.test(k))
			obj[k] = parseFloat(obj[k]);
	}
	return obj;
}

/**
@fn hd_back(pageRef?)

返回操作，类似history.back()，但如果当前页是入口页时，即使没有前一页，也可转向pageRef页（未指定时为首页）。
一般用于顶部返回按钮：

	<div class="hd">
		<a href="javascript:hd_back();" class="btn-icon"><i class="icon icon-back"></i></a>
		<h2>个人信息</h2>
	</div>

*/
window.hd_back = hd_back;
function hd_back(pageRef)
{
	var n = 0;
	MUI.m_pageStack.walk(function (state) {
		if (++ n > 1)
			return false;
	});
	// 页面栈顶
	if (n <= 1) {
		if (pageRef == null)
			pageRef = MUI.options.homePage;
		//if (m_allowedEntries==null || m_allowedEntries.indexOf("#" + MUI.activePage.attr("id")) >=0)
		if (! isLoginPage(MUI.activePage.attr("id")))
			MUI.showPage(pageRef);
		return;
	}
	history.back();
}

/**
@fn syslog(module, pri, content)

向后端发送日志。后台必须已添加syslog插件。
日志可在后台Syslog表中查看，客户端信息可查看ApiLog表。

@param module app,fw(framework),page
@param pri ERR,INF,WARN

示例：

	MUI.syslog("app", "ERR", "fail to pay: " + err.msg);

注意：如果操作失败，本函数不报错。
 */
self.syslog = syslog;
function syslog(module, pri, content)
{
	if (! Plugins.exists("syslog"))
		return;

	try {
		var postParam = {module: module, pri: pri, content: content};
		self.callSvr("Syslog.add", $.noop, postParam, {noex:1, noLoadingImg:1});
	} catch (e) {
		console.log(e);
	}
}

}
// vi: foldmethod=marker
