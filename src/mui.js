jdModule("jdcloud.mui", ns_jdcloud_mui);
function ns_jdcloud_mui()
{
var self = this;
var mCommon = jdModule("jdcloud.common");

// 子模块
ns_jdcloud_app.call(self);
ns_jdcloud_callSvr.call(self);
ns_jdcloud_mui_showPage.call(self);

// ====== global {{{
/**
@var isBusy

标识应用当前是否正在与服务端交互。一般用于自动化测试。
*/
self.isBusy = false;

/**
@var g_args

应用参数。

URL参数会自动加入该对象，例如URL为 `http://{server}/{app}/index.html?orderId=10&dscr=上门洗车`，则该对象有以下值：

	g_args.orderId=10; // 注意：如果参数是个数值，则自动转为数值类型，不再是字符串。
	g_args.dscr="上门洗车"; // 对字符串会自动进行URL解码。

此外，框架会自动加一些参数：

@var g_args._app?="user" 应用名称，由 WUI.options.appName 指定。

@see parseQuery URL参数通过该函数获取。
*/
window.g_args = {}; // {_test, _debug, cordova}

/**
@var g_cordova

值是一个整数，默认为0. 
如果非0，表示WEB应用在苹果或安卓APP中运行，且数值代表原生应用容器的大版本号。

示例：检查用户APP版本是否可以使用某些插件。

	if (g_cordova) { // 在原生APP中。可以使用插件。
		// 假如在IOS应用的大版本3中，加入了某插件，如果用户未升级，可提示他升级：
		if (g_cordova < 3 && isIOS()) {
			app_alert("您的版本太旧，XX功能无法使用，请升级到最新版本");
		}
	}

TODO: MUI.cordova
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
@var MUI.options

可用的选项如下。

@key MUI.options.appName?=user  应用名称

用于与后端通讯时标识app.

@key MUI.options.loginPage?="#login"  login逻辑页面的地址
@key MUI.options.homePage?="#home"  首页地址
@key MUI.options.pageFolder?="page" 逻辑页面文件(html及js)所在文件夹

@key MUI.options.noHandleIosStatusBar?=false

@see topic-iosStatusBar

@key MUI.options.manualSplash?=false
@see topic-splashScreen

@var MUI.options.logAction?=false  Boolean. 是否显示详细日志。
可用于交互调用的监控。

@var MUI.options.PAGE_SZ?=20  分页大小，下拉列表每次取数据的缺省条数。

@var MUI.options.mockDelay?=50  模拟调用后端接口的延迟时间，单位：毫秒。仅对异步调用有效。

@see MUI.mockData 模拟调用后端接口

@var MUI.options.serverUrl?="./"  服务端接口地址设置。
@var MUI.options.serverUrlAc  表示接口名称的URL参数。

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

@var MUI.options.pluginFolder?="../plugin" 指定筋斗云插件目录

筋斗云插件提供具有独立接口的应用功能模块，包括前端、后端实现。

@var MUI.options.showHash?=true

默认访问逻辑页面时，URL地址栏显示为: "index.html#me"

只读，如果值为false, 则地址栏显示为: "index.html/page/me.html".

注意：该选项不可通过js设置为false，而应在主页面中设置：

	<base href="./" mui-showHash="no">

在showHash=false时，必须设置base标签, 否则逻辑页将无法加载。
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

		pluginFolder: "../plugin",
		showHash: ($("base").attr("mui-showHash") != "no"),
	};

	var m_onLoginOK;
	var m_allowedEntries;

// ---- 通用事件 {{{
function document_pageCreate(ev)
{
	var jpage = $(ev.target);

	var jhdr = jpage.find("> .hd");
	// 标题栏空白处点击5次, 进入测试模式
	jhdr.click(function (ev) {
		// 注意避免子元素bubble导致的事件
		if ($(ev.target).hasClass("hd") || ev.target.tagName == "H1" || ev.target.tagName == "H2")
			switchTestMode(this); 
	});
}

$(document).on("pagecreate", document_pageCreate);

// ---- 处理ios7以上标题栏问题(应下移以空出状态栏)
// 需要定义css: #ios7statusbar
function handleIos7Statusbar()
{
	if(g_cordova){
		var ms = navigator.userAgent.match(/(iPad.*|iPhone.*|iPod.*);.*CPU.*OS (\d+)_\d/i);
		if(ms) {
			var ver = ms[2];
			if (ver >= 7) {
				self.container.css("margin-top", "20px");
			}
		}	
	}
}

/**
@fn MUI.setFormSubmit(jf, fn?, opt?={validate?, onNoAction?})

@param fn Function(data); 与callSvr时的回调相同，data为服务器返回的数据。
函数中可以使用this["userPost"] 来获取post参数。

@param opt.validate: Function(jf, queryParam={ac?,...}). 如果返回false, 则取消submit. queryParam为调用参数，可以修改。

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

*/
self.setFormSubmit = setFormSubmit;
function setFormSubmit(jf, fn, opt)
{
	opt = opt || {};
	jf.submit(function (ev) {
		ev.preventDefault();

		var queryParam = {ac: jf.attr("action")};
		if (opt.validate) {
			if (false === opt.validate(jf, queryParam))
				return false;
		}
		var postParam = mCommon.getFormData(jf);
		if (! $.isEmptyObject(postParam)) {
			var ac = queryParam.ac;
			delete queryParam.ac;
			callSvr(ac, queryParam, fn, postParam, {userPost: postParam});
		}
		else if (opt.onNoAction) {
			opt.onNoAction(jf);
		}
		return false;
	});
}
//}}}

// ------ cordova setup {{{
$(document).on("deviceready", function () {
	var homePageId = m_opt.homePage.substr(1); // "#home"
	// 在home页按返回键退出应用。
	$(document).on("backbutton", function () {
		if (self.activePage.attr("id") == homePageId) {
			app_alert("退出应用?", 'q', function () {
				navigator.app.exitApp();
			});
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
});

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
			pageRef = location.hash || m_opt.homePage;
		}
	}
	else if (page instanceof jQuery) {
		pageRef = "#" + page.attr("id");
	}
	else if (page === "#" || page === "") {
		pageRef = m_opt.homePage;
	}
	return pageRef;
}

/**
@fn MUI.showLogin(page?)
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
	m_onLoginOK = function () {
		// 如果当前仍在login系列页面上，则跳到指定页面。这样可以在handleLogin中用MUI.showPage手工指定跳转页面。
		if (MUI.activePage && isLoginPage(MUI.getToPageId()))
			MUI.showPage(pageRef);
	}
	MUI.showPage(m_opt.loginPage);
}

/**
@fn MUI.showHome()

显示主页。主页是通过 MUI.options.homePage 来指定的，默认为"#home".

要取主页名可以用：

	var jpage = $(MUI.options.homePage);

@see MUI.options.homePage
*/
self.showHome = showHome;
function showHome()
{
	self.showPage(m_opt.homePage);
}

/**
@fn MUI.logout(dontReload?)
@param dontReload 如果非0, 则注销后不刷新页面.

注销当前登录, 成功后刷新页面(除非指定dontReload=1)
*/
self.logout = logout;
function logout(dontReload)
{
	deleteLoginToken();
	g_data.userInfo = null;
	callSvr("logout", function () {
		if (! dontReload)
			mCommon.reloadSite();
	});
}

/**
@fn MUI.validateEntry(@allowedEntries) 入口页检查

设置入口页，allowedEntries是一个数组, 如果初始页面不在该数组中, 则URL中输入该逻辑页时，会自动转向主页。

示例：

	MUI.validateEntry([
		"#home",
		"#me",
	]);

*/
self.validateEntry = validateEntry;
// check if the entry is in the entry list. if not, refresh the page without search query (?xx) or hash (#xx)
function validateEntry(allowedEntries)
{
	if (allowedEntries == null)
		return;
	m_allowedEntries = allowedEntries;

	if (/*location.search != "" || */
			(location.hash && location.hash != "#" && allowedEntries.indexOf(location.hash) < 0) ) {
		location.href = location.pathname + location.search;
		self.app_abort();
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
				if (mCommon.isIOS()) {
					mCommon.loadScript(path + "cordova-ios/cordova.js?__HASH__,.."); 
				}
				else {
					mCommon.loadScript(path + "cordova/cordova.js?__HASH__,.."); 
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
@fn MUI.tryAutoLogin(onHandleLogin, reuseCmd?, allowNoLogin?=false)

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

	// first try "User.get"
	if (reuseCmd != null) {
		callSvr(reuseCmd, handleAutoLogin, null, ajaxOpt);
	}
	if (ok)
		return ok;

	// then use "login(token)"
	var token = loadLoginToken();
	if (token != null)
	{
		var param = {wantAll:1};
		var postData = {token: token};
		callSvr("login", param, handleAutoLogin, postData, ajaxOpt);
	}
	if (ok)
		return ok;

	if (! allowNoLogin)
	{
		self.showFirstPage = false;
		showLogin();
	}
	return ok;
}

/**
@fn MUI.handleLogin(data)
@param data 调用API "login"成功后的返回数据.

处理login相关的操作, 如设置g_data.userInfo, 保存自动登录的token等等.

*/
self.handleLogin = handleLogin;
function handleLogin(data)
{
	saveLoginToken(data);
	if (data.id == null)
		return;
	g_data.userInfo = data;

	// 登录成功后点返回，避免出现login页
	var popN = 0;
	self.m_pageStack.walk(function (state) {
		if (! isLoginPage(state.pageRef))
			return false;
		++ popN;
	});
	if (popN > 0)
		self.popPageStack(popN);

	if (m_onLoginOK) {
		var fn = m_onLoginOK;
		m_onLoginOK = null;
		setTimeout(fn);
	}
}
//}}}
//}}}

// ------ plugins {{{
/**
@fn MUI.initClient(param?)
*/
self.initClient = initClient;
var plugins_ = {};
function initClient(param)
{
	callSvrSync('initClient', param, function (data) {
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

// 单击5次，每次间隔不大于2s
function switchTestMode(obj)
{
	var INTERVAL = 4; // 2s
	var MAX_CNT = 5;
	var f = switchTestMode;
	var tm = new Date();
	// init, or reset if interval 
	if (f.cnt == null || f.lastTm == null || tm - f.lastTm > INTERVAL*1000 || f.lastObj != obj)
	{
		f.cnt = 0;
		f.lastTm = tm;
		f.lastObj = obj;
	}
//	console.log("switch: " + f.cnt);
	if (++ f.cnt >= MAX_CNT) {
		f.cnt = 0;
		f.lastTm = tm;
		var url = prompt("切换URL?", location.href);
		if (url == null || url === "" || url == location.href)
			return;
		if (url[0] == "/") {
			url = "http://" + url;
		}
		location.href = url;
		self.app_abort();
	}
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

	if (! m_opt.noHandleIosStatusBar)
		handleIos7Statusbar();
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
@fn MUI.formatField(obj) -> obj

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
			obj[k] = parseDate(obj[k]);
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
		<a href="javascript:hd_back();" class="icon icon-back"></a>
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
		if (m_allowedEntries==null || m_allowedEntries.indexOf("#" + MUI.activePage.attr("id")) >=0)
			MUI.showPage(pageRef);
		return;
	}
	history.back();
}

/**
@fn MUI.syslog(module, pri, content)

向后端发送日志。后台必须已添加syslog插件。
日志可在后台Syslog表中查看，客户端信息可查看ApiLog表。

注意：如果操作失败，本函数不报错。
 */
self.syslog = syslog;
function syslog(module, pri, content)
{
	if (! Plugins.exists("syslog"))
		return;

	try {
		var postParam = {module: module, pri: pri, content: content};
		callSvr("Syslog.add", $.noop, postParam, {noex:1, noLoadingImg:1});
	} catch (e) {
		console.log(e);
	}
}

}
// vi: foldmethod=marker
