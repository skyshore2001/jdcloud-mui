/*
页面管理器。提供基于逻辑页面的单网页应用，亦称“变脸式应用”。

该类作为MUI模块的基类，仅供内部使用，但它提供showPage等操作，以及pageshow等各类事件。

@param opt {homePage?="#home", pageFolder?="page"}

页面跳转测试用例：

- 使用MUI.showPage进行页面切换，如A->B->C，再通过浏览器返回、前进按钮查看跳转及切换动画是否正确
- 在控制台调用history.back/forward/go是否能正常工作。或左右划动页面查看前进后退是否正确。
- 在控制台调用location.hash="#xx"是否能正确切换页面。
- MUI.popPageStack()是否能正常工作。
- 在muiInit事件中调用MUI.showPage。
- 在A页面的pagebeforeshow事件中调用MUI.showPage(B)，不会闪烁，且点返回时不应回到A页面
 */
function JdcloudMuiPage()
{
var self = this;
var mCommon = jdModule("jdcloud.common");
	
/**
@var activePage

当前页面。

注意：

- 在初始化过程中，值可能为null;
- 调用MUI.showPage后，该值在新页面加载之后，发出pageshow事件之前更新。因而在pagebeforeshow事件中，MUI.activePage尚未更新。

要查看从哪个页面来，可以用 MUI.prevPageId。
要查看最近一次调用MUI.showPage转向的页面，可以用 MUI.getToPageId().

@see prevPageId
@see getToPageId()

*/
self.activePage = null;

/**
@var prevPageId

上一个页面的id, 首次进入时为空.
*/
self.prevPageId = null;

/**
@var container

应用容器，一般就是`$(document.body)`

@see .mui-container
*/
self.container = null;

/**
@var showFirstPage?=true

如果为false, 则必须手工执行 MUI.showPage 来显示第一个页面。
*/
self.showFirstPage = true;

var m_jstash; // 页面暂存区; 首次加载页面后可用
var m_jLoader;

// null: 未知
// true: back操作;
// false: forward操作, 或进入新页面
var m_isback = null; // 在changePage之前设置，在changePage中清除为null

// 调用showPage后，将要显示的页; 用于判断showPage过程中是否再次调用showPage.
var m_toPageId = null;
var m_lastPageRef = null;

var m_curState = null; // 替代history.state, 因为有的浏览器不支持。

var m_pageUrlMap = null; // {pageRef => url}

// @class PageStack {{{
var m_fn_history_go = history.go;
var m_appId = Math.ceil(Math.random() *10000);
function PageStack()
{
	// @var PageStack.stack_ - elem: {pageRef, id, isPoped?=0}
	this.stack_ = [];
	// @var PageStack.sp_
	this.sp_ = -1;
	// @var PageStack.nextId_
	this.nextId_ = 1;
}
PageStack.prototype = {
	// @fn PageStack.push(state={pageRef});
	push: function (state) {
		if (this.sp_ < this.stack_.length-1) {
			this.stack_.splice(this.sp_+1);
		}
		state.id = this.nextId_;
		++ this.nextId_;
		this.stack_.push(state);
		++ this.sp_;
	},
	// @fn PageStack.pop(n?=1); 
	// n=0: 清除到首页; n>1: 清除指定页数
	// 注意：pop时只做标记，没有真正做pop动作，没有改变栈指针sp_. 只有调用go才会修改栈指针。
	pop: function (n) {
		if (n === 0) {
			// pop(0): 保留第一个未pop的页面，其它全部标记为poped.
			var firstFound = false;
			for (var i=0; i<this.sp_; ++i) {
				if (! firstFound) {
					if (! this.stack_[i].isPoped)
						firstFound = true;
					continue;
				}
				this.stack_[i].isPoped = true;
			}
			return;
		}
		if (n == null || n < 0)
			n = 1;
		if (n > this.sp_) {
			n = this.sp_ + 1;
		}
		for (var i=0; i<n; ++i) {
			this.stack_[this.sp_ -i].isPoped = true;
		}
	},
	// @fn PageStack.go(n?=0);
	// 移动指定步数(忽略标记isPoped的页面以及重复页面)，返回实际步数. 0表示不可移动。
	go: function (n) {
		if (n == 0)
			return 0;
		var curState = this.stack_[this.sp_];
		do {
			var sp = this.sp_ + n;
			if (sp < 0 || sp >= this.stack_.length)
				return 0;
			if (! this.stack_[sp].isPoped && this.stack_[sp].pageRef != curState.pageRef)
				break;
			if (n < 0) {
				-- n;
			}
			else {
				++ n;
			}
		} while (1);
		this.sp_ = sp;
		return n;
	},
	// @fn PageStack.findCurrentState() -> n
	// Return: n - 当前状态到sp的偏移，可用 this.go(n) 移动过去。
	findCurrentState: function () {
		var found = false;
		var sp = this.sp_;
		var state = m_curState; //history.state;
		for (var i=this.stack_.length-1; i>=0; --i) {
			if (state.id == this.stack_[i].id)
			{
				sp = i;
				found = true;
				break;
			}
		}
		if (!found)
			throw "history not found";
		return sp - this.sp_;
	},
	// @fn PageStack.walk(fn)
	// @param fn Function(state={pageRef, isPoped}).  返回false则停止遍历。
	walk: function (fn) {
		for (var i=this.sp_; i>=0; --i) {
			var state = this.stack_[i];
			if (!state.isPoped && fn(state) === false)
				break;
		}
	}
};
//}}}

function getHash()
{
	//debugger;
	if (m_curState)
		return m_curState.pageRef;

	if (location.hash == "")
		return self.options.homePage;
	return location.hash;
}

// return pi=pageInfo={pageId, pageFile, templateRef?}
function setHash(pageRef, url)
{
	/*
m_curState.pageRef == pi.pageRef：history操作
m_curState==null: 首次进入，或hash改变
	 */
	//debugger;
	var pi = getPageInfo(pageRef);

	// 首次进入使用location.search
	if (m_pageUrlMap == null) {
		m_pageUrlMap = {};
		url = location.search;
	}
	if (url) {
		m_pageUrlMap[pageRef] = url;
	}
	else {
		url = m_pageUrlMap[pageRef];
	}
	if (self.options.showHash) {
		if (url == null) {
			url = pi.pageRef;
		}
		else if (url[0] == "?") {
			url = url + pi.pageRef;
		}
	}
	else {
		if (url == null) {
			url = pi.pageFile;
		}
		else if (url[0] == "?") {
			url = pi.pageFile + url;
		}
	}

	if (m_curState == null || m_curState.pageRef != pi.pageRef)
	{
		var newState = {pageRef: pi.pageRef, appId: m_appId, url: url};
		self.m_pageStack.push(newState);
		if (m_curState != null)
			history.pushState(newState, null, url);
		else
			history.replaceState(newState, null, url);
		m_curState = newState;
	}
	else if (m_curState.url != url) {
		history.replaceState(m_curState, null, url);
		m_curState.url = url;
	}
	return pi;
}

/**
@fn setUrl(url)

设置当前地址栏显示的URL. 如果url中不带hash部分，会自动加上当前的hash.

	MUI.setUrl("page/home.html"); // 设置url
	MUI.setUrl("?a=1&b=2"); // 设置url参数
	MUI.setUrl("?"); // 清除url参数部分。

如果要设置或删除参数，建议使用：

	MUI.setUrlParam("a", 1); // 如果参数存在，则会自动覆盖。
	MUI.deleteUrlParam("a"); // 从url中删除参数a部分，如果g_args中有参数a，也同时删除。

一般用于将应用程序内部参数显示到URL中，以便在刷新页面时仍然可显示相同的内容，或用于分享链接给别人。

例如订单页的URL为`http://server/app/#order`，现在希望：

- 要显示`id=100`的订单，在URL中显示`http://server/app/?orderId=100#order`
- 刷新该URL或分享给别人，均能正确打开`id=100`的订单。

示例：在逻辑页`order`的`pagebeforeshow`回调函数中，处理内部参数`opt`或URL参数`g_args`：

	function initPageOrder()
	{
		var jpage = this;
		var orderId_;
		jpage.on("pagebeforeshow", onPageBeforeShow);

		function onPageBeforeShow(ev, opt)
		{
			// 如果orderId_未变，不重新加载
			var skip = false;
			if (g_args.orderId) {
				orderId_ = g_args.orderId;
				// 只在初始进入时使用一次，用后即焚
				delete g_args.orderId;
			}
			else if (opt.orderId) {
				orderId_ = opt.orderId;
			}
			else {
				skip = true;
			}
			if (! orderId_) { // 参数不合法时跳回主页。
				MUI.showHome();
				return;
			}
			if (skip)
				return;
			MUI.setUrl("?orderId=" + orderId_);
			app_alert("show order " + orderId_);
		}
	}

在例子中，`opt`为`MUI.showPage()`时指定的参数，如调用`MUI.showPage("#order", {orderId: 100});`时，`opt.orderId=100`.
而`g_args`为全局URL参数，如打开 `http://server/app/index.html?orderId=100#order`时，`g_args.orderId=100`.

注意逻辑页`#order`应允许作为入口页进入，否则刷新时会跳转回主页。可在index.js中的validateEntry参数中加上逻辑页：

	MUI.validateEntry([
		...,
		"#order"
	]);

注意setUrl中以"?"开头，表示添加到URL参数中，保持URL主体部分不变。

如果`MUI.options.showHash=false`，则`MUI.setUrl("?orderId=100")`会将URL设置为`http://server/app/page/order.html?orderId=100`.
我们甚至可以设置RESTful风格的URL: `MUI.setUrl("order/100")` 会将URL设置为 `http://server/app/order/100`.

在上面两个例子中，为了确保刷新URL时能正常显示，必须在Web服务器上配置URL重写规则，让它们都重定向到 `http://server/app/?orderId=100#order`.
 */
self.setUrl = setUrl;
function setUrl(url)
{
	if (m_curState == null)
	{
		if (url.indexOf("#") < 0 && location.hash)
			url += location.hash;
		history.replaceState(null, null, url);
		return;
	}
	setHash(m_curState.pageRef, url);
}

/**
@fn deleteUrlParam(param)

自动修改g_args全局变量和当前url（会调用MUI.setUrl方法）。

	MUI.deleteUrlParam("wxpay");
	// 原先url为 http://myserver/myapp/index.html?wxpay=ORDR-11&storeId=1
	// 调用后为 http://myserver/myapp/index.html?storeId=1

 */
self.deleteUrlParam = deleteUrlParam;
function deleteUrlParam(param)
{
	delete g_args[param];
	var search = mCommon.deleteParam(location.search, param);
	MUI.setUrl(search);
}

/**
@fn setUrlParam(param, val)

修改当前url，添加指定参数。
e.g. 

	MUI.setUrlParam("wxauth", 1);

@see deleteUrlParam,MUI.appendParam
 */
self.setUrlParam = setUrlParam;
function setUrlParam(param, val)
{
	var search = location.search;
	if (search.indexOf(param + "=") >= 0) {
		search = mCommon.deleteParam(search, param);
	}
	search = mCommon.appendParam(search, param + "=" + val);
	if (search.indexOf('?&') >=0) {
		search = search.replace('?&', '?');
	}
	MUI.setUrl(search);
}

function callInitfn(jo, paramArr)
{
	var ret = jo.data("mui.init");
	if (ret !== undefined)
		return ret;

	var initfn = self.evalAttr(jo, "mui-initfn");
	if (initfn == null)
		return;

	if (initfn && $.isFunction(initfn))
	{
		ret = initfn.apply(jo, paramArr) || true;
	}
	jo.data("mui.init", ret);
	return ret;
}

// 页面栈处理 {{{
// return: false表示忽略之后的处理
function handlePageStack(pageRef)
{
	if (m_isback !== null)
		return;

	// 浏览器后退前进时, 同步m_pageStack, 并可能修正错误(忽略poped页面)
	var n = self.m_pageStack.findCurrentState();
	var n1 = self.m_pageStack.go(n);
	if (n != n1) {
		setTimeout(function () {
			m_fn_history_go.call(window.history, n1-n);
		});
		return false;
	}
	m_isback = n < 0;
}

function initPageStack()
{
	// 重写history的前进后退方法
	history.back = function () {
		return history.go(-1);
	};
	history.forward = function () {
		return history.go(1);
	};
	history.go = function (n) {
		// history.state.pageRef非空表示是框架做的页面处理。避免与第三方组件调用pushState冲突。
		if (history.state && history.state.pageRef) {
			var n = self.m_pageStack.go(n);
			if (n == 0)
				return false;
			m_isback = n < 0;
		}
		// history.go原函数
		return m_fn_history_go.call(this, n);
	};

	// 在移动端，左右划动页面可前进后退
	// 依赖jquery.touchSwipe组件
	if ('ontouchstart' in window && $.fn.swipe) {
		function swipeH(ev, direction, distance, duration, fingerCnt, fingerData, currentDirection) {
			var o = ev.target;
			while (o) {
				if ($(o).attr('mui-swipenav') === 'no')
					return;
				o = o.parentElement;
			}
			if (direction == 'right')
			{
				history.back();
			}
			else if (direction == 'left')
			{
				history.forward();
			}
		}
		$(document).swipe({
			excludedElements: "input,select,textarea,.noSwipe", // 与缺省相比，去掉了a,label,button
			swipeLeft: swipeH,
			swipeRight: swipeH,
			threshold: 100, // default=75
			// bug has fixed in jquery.touchSwipe.js, option preventDefaultEvents uses default=true, or else some device does not work
		});
	}
}
initPageStack();
// }}}

// "#"/"" => {pageId: "home", pageRef: "#home", pageFile: "{pageFolder}/home.html", templateRef: "#tpl_home"}
// "#aaa" => {pageId: "aaa", pageRef: "#aaa", pageFile: "{pageFolder}/aaa.html", templateRef: "#tpl_aaa"}
// "#xx/aaa.html" => {pageId: "aaa", pageRef: "#aaa", pageFile: "xx/aaa.html"}
// "#plugin1-page1" => 支持多级目录，如果plugin1不是一个插件：{pageId: "plugin1-page1", pageFile: "{pageFolder}/plugin1/page1.html"}
// "#plugin1-page1" => 如果plugin1是一个插件：{pageId: "plugin1-page1", pageFile: "{pluginFolder}/plugin1/m2/page/page1.html"}
function getPageInfo(pageRef)
{
	if (pageRef == "#" || pageRef == "" || pageRef == null)
		pageRef = self.options.homePage;
	var pageId = pageRef[0] == '#'? pageRef.substr(1): pageRef;
	var ret = {pageId: pageId, pageRef: pageRef};
	var p = pageId.lastIndexOf(".");
	if (p == -1) {
		p = pageId.lastIndexOf('-');
		if (p != -1) {
			var plugin = pageId.substr(0, p);
			var pageId2 = pageId.substr(p+1);
			if (Plugins.exists(plugin)) {
				ret.pageFile = self.options.pluginFolder + '/' + plugin + '/m2/page/' + pageId2 + '.html';
			}
		}
		ret.templateRef = "#tpl_" + pageId;
	}
	else {
		ret.pageFile = pageId;
		ret.pageId = pageId.match(/[^.\/]+(?=\.)/)[0];
	}
	if (ret.pageFile == null) 
		ret.pageFile = self.options.pageFolder + '/' + pageId.replace(/-/g, '/') + ".html";
	return ret;
}

/**
@fn showPage(pageRef, opt)

@param pageId String. 页面名字. 仅由字母、数字、"_"等字符组成。
@param pageRef String. 页面引用（即location.hash），以"#"开头，后面可以是一个pageId（如"#home"）或一个相对页的地址（如"#info.html", "#emp/info.html"）。
@param opt {ani?, url?}  (v3.3) 该参数会传递给pagebeforeshow/pageshow回调函数。

opt.ani:: String. 动画效果。设置为"none"禁用动画。

opt.url:: String. 指定在地址栏显示的地址。如 `showPage("#order", {url: "?id=100"})` 可设置显示的URL为 `page/order.html?id=100`.
@see setUrl

在应用内无刷新地显示一个页面。

例：

	MUI.showPage("#order");
	
显示order页，先在已加载的DOM对象中找id="order"的对象，如果找不到，则尝试找名为"tpl_home"的模板DOM对象，如果找不到，则以ajax方式动态加载页面"page/order.html"。

注意：

- 在加载页面时，只会取第一个DOM元素作为页面。

加载成功后，会将该页面的id设置为"order"，然后依次：

	调用 mui-initfn中指定的初始化函数，如 initPageOrder
	触发pagecreate事件
	触发pagebeforeshow事件
	触发pageshow事件

动态加载页面时，缺省目录名为`page`，如需修改，应在初始化时设置pageFolder选项：

	MUI.options.pageFolder = "mypage";

也可以显示一个指定路径的页面：

	MUI.showPage("#page/order.html");

由于它对应的id是order, 在显示时，先找id="order"的对象是否存在，如果不存在，则动态加载页面"page/order.html"并为该对象添加id="order".

在HTML中, 如果<a>标签的href属性以"#"开头，则会自动以showPage方式无刷新显示，如：

	<a href="#order">order</a>
	<a href="#emp/empinfo.html">empinfo</a>

可以通过`mui-opt`属性设置showPage的参数(若有多项，以逗号分隔)，如：

	<a href="#me" mui-opt="ani:'none'">me</a>

如果不想在应用内打开页面，只要去掉链接中的"#"即可：

	<a href="emp/empinfo.html">empinfo</a>

特别地，如果href属性以"#dlg"开头，则会自动以showDialog方式显示对话框，如

	<a href="#dlgSetUserInfo">set user info</a>

点击后相当于调用：

	MUI.showDialog(MUI.activePage.find("#dlgSetUserInfo"));

(v3.3) opt参数会传递到pagebeforeshow/pageshow参数中，如

	MUI.showPage("order", {orderId: 100});

	function initPageOrder()
	{
		var jpage = this;
		jpage.on("pagebeforeshow", function (ev, opt) {
			// opt={orderId: 100}
		});
		jpage.on("pageshow", function (ev, opt) {
			// opt={orderId: 100}
		});
	}
*/
self.showPage = showPage;
function showPage(pageRef, opt)
{
	if (self.container == null)
		return;

	if (pageRef == null)
		pageRef = getHash();
	else if (pageRef == "#")
		pageRef = self.options.homePage;
	else if (pageRef[0] != "#")
		pageRef = "#" + pageRef; // 为了兼容showPage(pageId), 新代码不建议使用

	// 避免hashchange重复调用
	if (m_lastPageRef == pageRef)
	{
		m_isback = null; // reset!
		return;
	}
	if (m_curState == null || m_curState.appId != m_appId) {
		m_isback = false; // 新页面
		//self.m_pageStack.push(pageRef);
	}

	var showPageOpt_ = $.extend({
		ani: self.options.ani
	}, opt);

	var ret = handlePageStack(pageRef);
	if (ret === false)
		return;

	m_lastPageRef = pageRef;

	var pi = setHash(pageRef, showPageOpt_.url);

	// find in document
	var pageId = pi.pageId;
	m_toPageId = pageId;
	var jpage = self.container.find("#" + pageId + ".mui-page");
	// find in template
	if (jpage.size() > 0)
	{
		changePage(jpage);
		return;
	}

	var jtpl = pi.templateRef? $(pi.templateRef): null;
	if (jtpl && jtpl.size() > 0) {
		var html = jtpl.html();
		// webcc内嵌页面时，默认使用script标签（因为template尚且普及），其中如果有script都被替换为__script__, 这里做还原。
		if (jtpl[0].tagName == 'SCRIPT') {
			html = html.replace(/__script__/g, 'script');
		}
		// bugfix: 用setTimeout解决微信浏览器切页动画显示异常
		setTimeout(function () {
			loadPage(html, pageId);
		});
	}
	else {
		self.enterWaiting(); // NOTE: leaveWaiting in initPage
		var m = pi.pageFile.match(/(.+)\//);
		var path = m? m[1]: "";
		$.ajax(pi.pageFile, {error: null}).then(function (html) {
			loadPage(html, pageId, path);
		}).fail(function () {
			self.leaveWaiting();
			self.app_alert("找不到页面: " + pageId, "e");
			history.back();
			return false;
		});
	}

	// path?=self.options.pageFolder
	function loadPage(html, pageId, path)
	{
		// 放入dom中，以便document可以收到pagecreate等事件。
		if (m_jstash == null) {
			m_jstash = $("<div id='muiStash' style='display:none'></div>").appendTo(self.container);
		}
		// 注意：如果html片段中有script, 在append时会同步获取和执行(jquery功能)
		var jpage = $(html).filter("div");
		if (jpage.size() > 1 || jpage.size() == 0) {
			console.log("!!! Warning: bad format for page '" + pageId + "'. Element count = " + jpage.size());
			jpage = jpage.filter(":first");
		}

		// 限制css只能在当前页使用
		jpage.find("style:not([mui-nofix])").each(function () {
			$(this).html( self.ctx.fixPageCss($(this).html(), "#" + pageId) );
		});
		// bugfix: 加载页面页背景图可能反复被加载
		jpage.find("style").attr("mui-origin", pageId).appendTo(document.head);
		jpage.attr("id", pageId).addClass("mui-page")
			.hide().appendTo(self.container);

		var val = jpage.attr("mui-script");
		if (val != null) {
			if (path == null)
				path = self.options.pageFolder;
			if (path != "")
				val = path + "/" + val;
			var dfd = mCommon.loadScript(val, initPage);
			dfd.fail(function () {
				self.app_alert("加载失败: " + val);
				self.leaveWaiting();
				history.back();
			});
		}
		else {
			initPage();
		}

		function initPage()
		{
			var dep = self.evalAttr(jpage, "mui-deferred");
			if (dep) {
				self.assert(dep.then, "*** mui-deferred attribute DOES NOT return a deferred object");
				jpage.removeAttr("mui-deferred");
				dep.then(initPage);
				return;
			}

			// 检测运营商js劫持，并自动恢复。
			var fname = jpage.attr("mui-initfn");
			if (fname && window[fname] == null) {
				// 10s内重试
				var failTry_ = jpage.data("failTry_");
				var dt = new Date();
				if (failTry_ == null) {
					self.app_alert("逻辑页错误，或页面被移动运营商劫持! 正在重试...");
					failTry_ = dt;
					jpage.data("failTry_", failTry_);
				}
				if (dt - failTry_ < 10000)
					setTimeout(initPage, 200);
				else
					console.log("逻辑页加载失败: " + jpage.attr("id"));
				return;
			}

			var ret = callInitfn(jpage);
			if (ret instanceof jQuery)
				jpage = ret;
			jpage.trigger("pagecreate");
			self.enhanceWithin(jpage);
			changePage(jpage);
			self.leaveWaiting();
		}
	}

	function changePage(jpage)
	{
		// TODO: silde in for goback
		if (self.activePage && self.activePage[0] === jpage[0])
			return;

		var oldPage = self.activePage;
		if (oldPage) {
			self.prevPageId = oldPage.attr("id");
		}
		var toPageId = jpage.attr("id");
		jpage.trigger("pagebeforeshow", [showPageOpt_]);
		// 如果在pagebeforeshow中调用showPage显示其它页，则不显示当前页，避免页面闪烁。
		if (toPageId != m_toPageId)
		{
			// 类似于调用popPageStack(), 避免返回时再回到该页面
			var pageRef = "#" + toPageId;
			self.m_pageStack.walk(function (state) {
				if (state.pageRef == pageRef) {
					state.isPoped = true;
					return false;
				}
			});
			return;
		}

		var enableAni = showPageOpt_.ani !== 'none'; // TODO
		var slideInClass = m_isback? "slideIn1": "slideIn";
		m_isback = null;
		self.container.show(); // !!!! 
		jpage.css("z-index", 1).show();
		if (oldPage)
			oldPage.css("z-index", "-1");
		if (enableAni) {
			jpage.addClass(slideInClass);
			jpage.one("animationend", onAnimationEnd)
				.one("webkitAnimationEnd", onAnimationEnd);

// 				if (oldPage)
// 					oldPage.addClass("slideOut");
		}
		self.activePage = jpage;
		fixPageSize();
		var title = jpage.find(".hd h1, .hd h2").filter(":first").text() || self.title || jpage.attr("id");
		setDocTitle(title);

		if (!enableAni) {
			onAnimationEnd();
		}
		function onAnimationEnd()
		{
			if (enableAni) {
				// NOTE: 如果不删除，动画效果将导致fixed position无效。
				jpage.removeClass(slideInClass);
// 					if (oldPage)
// 						oldPage.removeClass("slideOut");
			}
			if (toPageId != m_toPageId)
				return;
			jpage.trigger("pageshow", [showPageOpt_]);
			if (oldPage) {
				oldPage.trigger("pagehide");
				oldPage.hide();
			}
		// TODO: destroy??
// 				if (oldPage.attr("autoDestroy")) {
// 					oldPage.remove();
// 				}
		}
	}
}

/**
@fn setDocTitle(title)

设置文档标题。默认在切换页面时，会将文档标题设置为逻辑页的标题(`hd`块中的`h1`或`h2`标签)。
*/
self.setDocTitle = setDocTitle;
function setDocTitle(newTitle)
{
	document.title = newTitle;
	if(mCommon.isIOS() && mCommon.isWeixin()) {
		document.title = newTitle;
		var $iframe = $('<iframe src="/favicon.ico"></iframe>');
		$iframe.one('load',function() {
			setTimeout(function() {
				$iframe.remove();
			}, 0);
		}).appendTo(self.container);
	}
}

/**
@fn unloadPage(pageRef?)

@param pageRef 如未指定，表示当前页。

删除一个页面。
*/
self.unloadPage = unloadPage;
function unloadPage(pageRef)
{
	var jo = null;
	var pageId = null;
	if (pageRef == null) {
		jo = self.activePage;
		pageId = jo.attr("id");
		pageRef = "#" + pageId;
	}
	else {
		if (pageRef[0] == "#") {
			pageId = pageRef.substr(1);
		}
		else {
			pageId = pageRef;
			pageRef = "#" + pageId;
		}
		jo = $(pageRef);
	}
	if (jo.find("#footer").size() > 0)
		jo.find("#footer").appendTo(m_jstash);
	jo.remove();
	$("style[mui-origin=" + pageId + "]").remove();
}

/**
@fn reloadPage(pageRef?, opt?)

@param pageRef 如未指定，表示当前页。
@param opt 传递给MUI.showPage的opt参数。参考MUI.showPage.

重新加载指定页面。不指定pageRef时，重加载当前页。
*/
self.reloadPage = reloadPage;
function reloadPage(pageRef, opt)
{
	if (pageRef == null)
		pageRef = "#" + self.activePage.attr("id");
	unloadPage(pageRef);
	m_lastPageRef = null; // 防止showPage中阻止运行
	showPage(pageRef, opt);
}

/**
@var m_pageStack

页面栈，MUI.popPageStack对它操作
*/
self.m_pageStack = new PageStack();

/** 
@fn popPageStack(n?=1) 

n=0: 退到首层, >0: 指定pop几层

常用场景：

添加订单并进入下个页面后, 点击后退按钮时避免再回到添加订单页面, 应调用

	MUI.popPageStack(); // 当前页（提交订单页）被标记poped
	MUI.showPage("#xxx"); // 进入下一页。之后回退时，可跳过被标记的前一页

如果添加订单有两步（两个页面），希望在下个后面后退时跳过前两个页面, 可以调用

	MUI.popPageStack(2);
	MUI.showPage("#xxx");

如果想在下个页面后退时直接回到初始进入应用的逻辑页（不一定是首页）, 可以调用：（注意顺序！）

	MUI.showPage("#xxx");
	MUI.popPageStack(0); // 标记除第一页外的所有页为poped, 所以之后回退时直接回到第一页。

如果只是想立即跳回两页，不用调用popPageStack，而应调用：

	history.go(-2);

*/
self.popPageStack = popPageStack;
function popPageStack(n)
{
	self.m_pageStack.pop(n);
}

$(window).on('popstate', function (ev) {
	m_curState = ev.originalEvent.state;
	if (m_curState) // bugfix: 红米等某些手机在MUI.options.showHash=false模式下，且在安卓APP中，进入非主页的入口页，会自动跳转回主页。
		showPage();
});


$(window).on('orientationchange', fixPageSize);
$(window).on('resize'           , fixPageSize);

function fixPageSize()
{
	if (self.activePage) {
		var jpage = self.activePage;
		var H = self.container.height();
		var jo, hd, ft;
		jo= jpage.find(">.hd");
		hd = (jo.size() > 0 && jo.css("display") != "none")? jo.height() : 0;
		ft = 0;
		jpage.find(">.ft").each(function () {
			if ($(this).is(":visible"))
				ft += $(this).height();
		});
		jpage.height(H);
		jpage.find(">.bd").css({
			top: hd,
			bottom: ft
		});
	}
}

/**
@fn getToPageId()

返回最近一次调用MUI.showPage时转向页面的Id.

@see prevPageId
 */
self.getToPageId = getToPageId;
function getToPageId()
{
	return m_toPageId;
}

// ------- ui: navbar and footer {{{

self.m_enhanceFn["#footer"] = enhanceFooter;
self.m_enhanceFn[".mui-navbar"] = enhanceNavbar;

function activateElem(jo)
{
	if (jo.hasClass("active"))
		return;

	var jo1 = jo.parent().find(">*.active").removeClass("active");
	jo.addClass("active");

	handleLinkto(jo, true);
	handleLinkto(jo1, false);

	function handleLinkto(jo, active)
	{
		var ref = jo.attr("mui-linkto");
		if (ref) {
			var jlink = jo.closest(".mui-page").find(ref); // DONT use self.activePage that may be wrong on pagebeforeshow
			jlink.toggle(active);
			jlink.toggleClass("active", active);
		}
	}
}

function enhanceNavbar(jo)
{
	// 如果有noactive类，则不自动点击后active
	if (jo.hasClass("noactive"))
		return;

	// 确保有且只有一个active
	var ja = jo.find(">.active");
	if (ja.size() == 0) {
		ja = jo.find(">:first").addClass("active");
	}
	else if (ja.size() > 1) {
		ja.filter(":not(:first)").removeClass("active");
		ja = ja.filter(":first");
	}

	var jpage_ = null;
	jo.find(">*").on('click', function () {
		activateElem($(this));
	})
	// 确保mui-linkto指向对象active状态与navbar一致
	.each (function () {
		var ref = $(this).attr("mui-linkto");
		if (ref) {
			if (jpage_ == null)
				jpage = jo.closest(".mui-page");
			var active = $(this).hasClass("active");
			var jlink = jpage.find(ref);
			jlink.toggle(active);
			jlink.toggleClass("active", active);
		}
	});
}

function enhanceFooter(jfooter)
{
	enhanceNavbar(jfooter);
	jfooter.addClass("ft").addClass("mui-navbar");
	var jnavs = jfooter.find(">a");
	var id2nav = null;

	function getNav(pageId) {
		if (id2nav == null) {
			id2nav = {};
			jnavs.each(function(i, e) {
				if (e.style.display == "none")
					return;
				var m = e.href.match(/#([\w-]+)/);
				if (m) {
					id2nav[m[1]] = e;
				}
			});
		}
		return id2nav[pageId];
	}

	$(document).on("pagebeforeshow", function (ev) {
		var jpage = $(ev.target);
		var pageId = jpage.attr("id");
		if (m_toPageId != pageId)
			return;
		var e = getNav(pageId);
		if (e === undefined)
		{
			if (jfooter.parent()[0] !== m_jstash[0])
				jfooter.appendTo(m_jstash);
			return;
		}
		var jft = jpage.find(".ft");
		if (jft.size() > 0) {
			setTimeout(function () {
				jft.css("bottom", jfooter.height());
			});
		}
		jfooter.appendTo(jpage);
		activateElem($(e));
	});
}

//}}}
// ------- ui: dialog {{{

self.m_enhanceFn[".mui-dialog, .mui-menu"] = enhanceDialog;

function enhanceDialog(jo)
{
	jo.wrap("<div class=\"mui-mask\" style=\"display:none\"></div>");
	var isMenu = jo[0].classList.contains("mui-menu");
	jo.parent().click(function (ev) {
		if (!isMenu && this !== ev.target)
			return;
		closeDialog(jo);
	});
}

/**
@fn showDialog(jdlg)
*/
self.showDialog = showDialog;
function showDialog(jdlg)
{
	if (jdlg.constructor === String) {
		jdlg = MUI.activePage.find(jdlg);
	}
	var opt = self.getOptions(jdlg);
	if (opt.initfn) {
		opt.onBeforeShow = opt.initfn.call(jdlg);
		opt.initfn = null;
	}
	if (opt.onBeforeShow)
		opt.onBeforeShow.call(jdlg);
	jdlg.show();
	jdlg.parent().show();
	//bugfix: 如果首页未显示就出错，app_alert无法显示
	self.container.show(); 
}

/**
@fn closeDialog(jdlg, remove=false)
*/
self.closeDialog = closeDialog;
function closeDialog(jdlg, remove)
{
	if (remove) {
		jdlg.parent().remove();
		return;
	}
	jdlg.parent().hide();
}

/**
@fn setupDialog(jdlg, initfn)

@return 可以不返回, 或返回一个回调函数beforeShow, 在每次Dialog显示前调用.

使用该函数可设置dialog的初始化回调函数和beforeShow回调.

使用方法:

	MUI.setupDialog(jdlg, function () {
		var jdlg = this;
		jdlg.find("#btnOK").click(btnOK_click);

		function btnOK_click(ev) { }

		function beforeShow() {
			// var jdlg = this;
			var jtxt = jdlg.find("#txt1");
			callSvr("getxxx", function (data) {
				jtxt.val(data);
			});
		}
		return beforeShow;
	});

*/
self.setupDialog = setupDialog;
function setupDialog(jdlg, initfn)
{
	self.getOptions(jdlg).initfn = initfn;
}

/**
@fn app_alert(msg, [type?=i], [fn?], opt?={timeoutInterval?, defValue?, onCancel()?})
@key #muiAlert
@param type 对话框类型: "i": info, 信息提示框; "e": error, 错误框; "w": warning, 警告框; "q": question, 确认框(会有"确定"和"取消"两个按钮); "p": prompt, 输入框
@param fn Function(text?) 回调函数，当点击确定按钮时调用。当type="p" (prompt)时参数text为用户输入的内容。
@param opt Object. 可选项。 timeoutInterval表示几秒后自动关闭对话框。defValue用于输入框(type=p)的缺省值.

onCancel: 用于"q", 点取消时回调.

示例:

	// 信息框，3s后自动点确定
	app_alert("操作成功", function () {
		MUI.showPage("#orders");
	}, {timeoutInterval: 3000});

	// 错误框
	app_alert("操作失败", "e");

	// 确认框(确定/取消)
	app_alert("立即付款?", "q", function () {
		MUI.showPage("#pay");
	});

	// 输入框
	app_alert("输入要查询的名字:", "p", function (text) {
		callSvr("Book.query", {cond: "name like '%" + text + "%'});
	});

可自定义对话框，接口如下：

- 对象id为muiAlert, class包含mui-dialog.
- .p-title用于设置标题; .p-msg用于设置提示文字
- 两个按钮 #btnOK, #btnCancel，仅当type=q (question)时显示btnCancel.
- 输入框 #txtInput，仅当type=p (prompt)时显示。

示例：

	<div id="muiAlert" class="mui-dialog">
		<h3 class="p-title"></h3>
		<div class="p-msg"></div>
		<input type="text" id="txtInput"> <!-- 当type=p时才会显示 -->
		<div>
			<a href="javascript:;" id="btnOK" class="mui-btn primary">确定</a>
			<a href="javascript:;" id="btnCancel" class="mui-btn">取消</a>
		</div>
	</div>

app_alert一般会复用对话框 muiAlert, 除非层叠开多个alert, 这时将clone一份用于显示并在关闭后删除。

*/
window.app_alert = self.app_alert = app_alert;
function app_alert(msg)
{
	var type = "i";
	var fn = null;
	var alertOpt = {};

	for (var i=1; i<arguments.length; ++i) {
		var arg = arguments[i];
		if ($.isFunction(arg)) {
			fn = arg;
		}
		else if ($.isPlainObject(arg)) {
			alertOpt = arg;
		}
		else if (typeof(arg) === "string") {
			type = arg;
		}
	}


	//var cls = {i: "mui-info", w: "mui-warning", e: "mui-error", q: "mui-question", p: "mui-prompt"}[type];
	var s = {i: "提示", w: "警告", e: "出错了", q: "确认", p: "输入"}[type];

	var jdlg = self.container.find("#muiAlert");
	if (jdlg.size() == 0) {
		var html = '' + 
'<div id="muiAlert" class="mui-dialog">' + 
'	<h3 class="hd p-title"></h3>' + 
'	<div class="sp p-msg"></div>' +
'	<input type="text" id="txtInput" style="border:1px solid #bbb; line-height:1.5">' +
'	<div class="sp nowrap">' +
'		<a href="javascript:;" id="btnOK" class="mui-btn primary">确定</a>' +
'		<a href="javascript:;" id="btnCancel" class="mui-btn">取消</a>' +
'	</div>' +
'</div>'
		jdlg = $(html);
		self.enhanceWithin(jdlg);
		jdlg.parent().appendTo(self.container);
	}

	var isClone = false;
	// 如果正在显示，则使用clone
	if (jdlg.parent().is(":visible")) {
		var jo = jdlg.parent().clone().appendTo(self.container);
		jdlg = jo.find(".mui-dialog");
		isClone = true;
	}
	var opt = self.getOptions(jdlg);
	if (opt.type == null) {
		jdlg.find("#btnOK, #btnCancel").click(app_alert_click);
		jdlg.keydown(app_alert_keydown);
	}
	opt.type = type;
	opt.fn = fn;
	opt.alertOpt = alertOpt;
	opt.isClone = isClone;

	jdlg.find("#btnCancel").toggle(type == "q" || type == "p");
	var jtxt = jdlg.find("#txtInput");
	jtxt.toggle(type == "p");
	if (type == "p") {
		jtxt.val(alertOpt.defValue);
		setTimeout(function () {
			jtxt.focus();
		});
	}

	jdlg.find(".p-title").html(s);
	jdlg.find(".p-msg").html(msg);
	self.showDialog(jdlg);

	if (alertOpt.timeoutInterval != null) {
		opt.timer = setTimeout(function() {
			// 表示上次显示已结束
			jdlg.find("#btnOK").click();
		}, alertOpt.timeoutInterval);
	}
}

// jdlg.opt: {fn, type, alertOpt, timer, isClone}
function app_alert_click(ev)
{
	var jdlg = $(this).closest("#muiAlert");
	mCommon.assert(jdlg.size()>0);
	var opt = self.getOptions(jdlg);
	if (opt.timer) {
		clearInterval(opt.timer);
		opt.timer = null;
	}
	var btnId = this.id;
	if (opt.fn && btnId == "btnOK") {
		if (opt.type == "p") {
			var text = jdlg.find("#txtInput").val();
			if (text != "") {
				opt.fn(text);
			}
			else if (opt.alertOpt.onCancel) {
				opt.alertOpt.onCancel();
			}
		}
		else {
			opt.fn();
		}
	}
	else if (btnId == "btnCancel" && opt.alertOpt.onCancel) {
		opt.alertOpt.onCancel();
	}
	self.closeDialog(jdlg, opt.isClone);
}

function app_alert_keydown(ev)
{
	if (ev.keyCode == 13) {
		return $(this).find("#btnOK").click();
	}
	else if (ev.keyCode == 27) {
		return $(this).find("#btnCancel").click();
	}
}

/**
@fn showLoading()
*/
self.showLoading = showLoading;
function showLoading()
{
	if (m_jLoader == null) {
		m_jLoader = $("<div class='mui-loader'></div>");
	}
	m_jLoader.appendTo(document.body);
}
	
/**
@fn hideLoading()
*/
self.hideLoading = hideLoading;
function hideLoading()
{
	if (m_jLoader)
		m_jLoader.remove();
}

//}}}
// ------- ui: anchor {{{

self.m_enhanceFn["a[href^=#]"] = enhanceAnchor;

function enhanceAnchor(jo)
{
	if (jo.attr("onclick"))
		return;
	// 使用showPage, 与直接链接导致的hashchange事件区分
	jo.click(function (ev) {
		ev.preventDefault();
		var href = jo.attr("href");
		// 如果名字以 "#dlgXXX" 则自动打开dialog
		if (href.substr(1,3) == "dlg") {
			var jdlg = self.activePage.find(href);
			self.showDialog(jdlg);
			return;
		}
		var opt = self.evalAttr(jo, "mui-opt");
		self.showPage(href, opt);
	});
}
//}}}

// ------ main
	
function main()
{
	self.title = document.title;
	self.container = $(".mui-container");
	if (self.container.size() == 0)
		self.container = $(document.body);
	self.enhanceWithin(self.container);

	// 在muiInit事件中可以调用showPage.
	self.container.trigger("muiInit");

	// 根据hash进入首页
	if (self.showFirstPage)
		showPage();
}

$(main);

}
