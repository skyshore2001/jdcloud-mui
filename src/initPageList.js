jdModule("jdcloud.mui", ns_jdcloud_mui_list_page);
function ns_jdcloud_mui_list_page()
{
var self = this;
var mCommon = jdModule("jdcloud.common");

/**
@fn initPullList(container, opt)

为列表添加下拉刷新和上拉加载功能。

例：页面元素如下：

	<div mui-initfn="initPageOrders" mui-script="orders.js">
		<div class="bd">
			<div class="p-list"></div>
		</div>
	</div>

设置下拉列表的示例代码如下：

	var pullListOpt = {
		onLoadItem: showOrderList
	};
	var container = jpage.find(".bd")[0];
	initPullList(container, pullListOpt);

	var nextkey;
	function showOrderList(isRefresh)
	{
		var jlst = jpage.find(".p-list");
		var param = {res: "id desc", cond: "status=1"};
		if (nextkey == null)
			isRefresh = true;
		if (isRefresh)
			jlst.empty();
		param._pagekey = nextkey;

		callSvr("Ordr.query", param, function (data) {
			// create items and append to jlst
			// ....
			if (data.nextkey)
				nextkey = data.nextkey;
			// TODO: 处理分页结束即nextkey为空的情况。
		});
	}

注意：

- 由于page body的高度自动由框架设定，所以可以作为带滚动条的容器；如果是其它容器，一定要确保它有限定的宽度，以便可以必要时出现滚动条。
- *** 由于处理分页的逻辑比较复杂，请调用 initPageList替代, 即使只有一个list；它会屏蔽nextkey, refresh等细节，并做一些优化。像这样调用：

		initPageList(jpage, {
			pageItf: PageOrders,
			navRef: null,
			listRef: jlst,
			onGetQueryParam: ...
			onAddItem: ...
		});

本函数参数如下：

@param container 容器，它的高度应该是限定的，因而当内部内容过长时才可出现滚动条
@param opt {onLoadItem, autoLoadMore?=true, threshold?=180, onHint?, onPull?}

@param opt.onLoadItem function(isRefresh)

在合适的时机，它调用 onLoadItem(true) 来刷新列表，调用 onLoadItem(false) 来加载列表的下一页。在该回调中this为container对象（即容器）。实现该函数时应当自行管理当前的页号(pagekey)

@param opt.autoLoadMore 当滑动到页面下方时（距离底部TRIGGER_AUTOLOAD=30px以内）自动加载更多项目。

@param threshold 像素值。

手指最少下划或上划这些像素后才会触发实际加载动作。

@param opt.onHint function(ac, dy, threshold)

	ac  动作。"D"表示下拉(down), "U"表示上拉(up), 为null时应清除提示效果.
	dy,threshold  用户移动偏移及临界值。dy>threshold时，认为触发加载动作。

提供提示用户刷新或加载的动画效果. 缺省实现是下拉或上拉时显示提示信息。

@param opt.onHintText function(ac, uptoThreshold)

修改用户下拉/上拉时的提示信息。仅当未设置onHint时有效。onHint会生成默认提示，如果onHintText返回非空，则以返回内容替代默认内容。
内容可以是一个html字符串，所以可以加各种格式。

	ac:: String. 当前动作，"D"或"U".
	uptoThreshold:: Boolean. 是否达到阈值

@param opt.onPull function(ev)

如果返回false，则取消上拉加载或下拉刷新行为，采用系统默认行为。

*/
self.initPullList = initPullList;
function initPullList(container, opt)
{
	var opt_ = $.extend({
		threshold: 180,
		onHint: onHint,
		autoLoadMore: true,
	}, opt);
	var cont_ = container;

	var touchev_ = null; // {ac, x0, y0}
	var mouseMoved_ = false;
	var SAMPLE_INTERVAL = 200; // ms
	var TRIGGER_AUTOLOAD = 30; // px

	var lastUpdateTm_ = new Date();
	var dy_; // 纵向移动。<0为上拉，>0为下拉

	window.requestAnimationFrame = window.requestAnimationFrame || function (fn) {
		setTimeout(fn, 1000/60);
	};

	if ("ontouchstart" in window) {
		cont_.addEventListener("touchstart", touchStart);
		cont_.addEventListener("touchmove", touchMove);
		cont_.addEventListener("touchend", touchEnd);
		cont_.addEventListener("touchcancel", touchCancel);
	}
	else {
		cont_.addEventListener("mousedown", mouseDown);
	}
	if ($(cont_).css("overflowY") == "visible") {
		cont_.style.overflowY = "auto";
	}

	function getPos(ev)
	{
		var t = ev;
		if (ev.changedTouches) {
			t = ev.changedTouches[0];
		}
		return [t.pageX, t.pageY];
	}

	var jo_;
	function onHint(ac, dy, threshold)
	{
		var msg = null;
		if (jo_ == null) {
			jo_ = $("<div class='mui-pullPrompt'></div>");
		}

		var uptoThreshold = dy >= threshold;
		if (ac == "U") {
			msg = uptoThreshold? "<b>松开加载~~~</b>": "即将加载...";
		}
		else if (ac == "D") {
			msg = uptoThreshold? "<b>松开刷新~~~</b>": "即将刷新...";
		}
		if (opt_.onHintText) {
			var rv = opt_.onHintText(ac, uptoThreshold);
			if (rv != null)
				msg = rv;
		}
		var height = Math.min(dy, 100, 2.0*Math.pow(dy, 0.7));

		if (msg == null) {
			jo_.height(0).remove();
			return;
		}
		jo_.html(msg);
		jo_.height(height).css("lineHeight", height + "px");
			
		if (ac == "D") {
			var c = cont_.getElementsByClassName("mui-pullHint")[0];
			if (c)
				jo_.appendTo(c);
			else
				jo_.prependTo(cont_);
		}
		else if (ac == "U") {
			jo_.appendTo(cont_);
		}
	}

	// ac为null时，应清除提示效果
	function updateHint(ac, dy)
	{
		if (ac == null || dy == 0 || (opt_.autoLoadMore && ac == 'U')) {
			ac = null;
		}
		else {
			dy = Math.abs(dy);
		}
		opt_.onHint.call(this, ac, dy, opt_.threshold);
	}

	function touchStart(ev)
	{
		if (opt_.onPull && opt_.onPull(ev) === false) {
			ev.cancelPull_ = true;
			return;
		}

		var p = getPos(ev);
		touchev_ = {
			ac: null,
			// 原始top位置
			top0: cont_.scrollTop,
			// 原始光标位置
			x0: p[0],
			y0: p[1],
			// 总移动位移
			dx: 0,
			dy: 0,

			// 用于惯性滚动: 每SAMPLE_INTERVAL取样时最后一次时间及光标位置(用于计算初速度)
			momentum: {
				x0: p[0],
				y0: p[1],
				startTime: new Date()
			}
		};
		//ev.preventDefault(); // 防止click等事件无法触发
	}

	function mouseDown(ev)
	{
		mouseMoved_ = false;
		touchStart(ev);
		if (ev.cancelPull_ === true)
			return;
		// setCapture
		window.addEventListener("mousemove", mouseMove, true);
		window.addEventListener("mouseup", mouseUp, true);
		window.addEventListener("click", click, true);
	}

	// 防止拖动后误触发click事件
	function click(ev)
	{
		window.removeEventListener("click", click, true);
		if (mouseMoved_)
		{
			ev.stopPropagation();
			ev.preventDefault();
		}
	}

	function mouseMove(ev)
	{
		touchMove(ev);
		if (touchev_ == null)
			return;

		if (touchev_.dx != 0 || touchev_.dy != 0)
			mouseMoved_ = true;
		ev.stopPropagation();
		ev.preventDefault();
	}

	function mouseUp(ev)
	{
		touchEnd(ev);
		window.removeEventListener("mousemove", mouseMove, true);
		window.removeEventListener("mouseup", mouseUp, true);
		ev.stopPropagation();
		ev.preventDefault();
	}

	function touchMove(ev)
	{
		if (touchev_ == null)
			return;
		var p = getPos(ev);
		var m = touchev_.momentum;
		if (m) {
			var now = new Date();
			if ( now - m.startTime > SAMPLE_INTERVAL ) {
				m.startTime = now;
				m.x0 = p[0];
				m.y0 = p[1];
			}
		}

		touchev_.dx = p[0] - touchev_.x0;
		touchev_.dy = p[1] - touchev_.y0;
		dy_ = touchev_.dy;

		// 如果不是竖直下拉，则取消
		if (touchev_.dy == 0 || Math.abs(touchev_.dx) > Math.abs(touchev_.dy)) {
			touchCancel();
			return;
		}

		cont_.scrollTop = touchev_.top0 - touchev_.dy;
		var dy = touchev_.dy + (cont_.scrollTop - touchev_.top0);
		touchev_.pully = dy;

		if (cont_.scrollTop <= 0 && dy > 0) {
			touchev_.ac = "D";
		}
		else if (dy < 0 && cont_.scrollTop >= cont_.scrollHeight - cont_.clientHeight) {
			touchev_.ac = "U";
		}
		updateHint(touchev_.ac, dy);
		ev.preventDefault();
	}

	function touchCancel(ev)
	{
		touchev_ = null;
		updateHint(null, 0);
	}

	function momentumScroll(ev, onScrollEnd)
	{
		if (touchev_ == null || touchev_.momentum == null)
			return;

		// 惯性滚动
		var m = touchev_.momentum;
		var dt = new Date();
		var duration = dt - m.startTime;
		if (duration > SAMPLE_INTERVAL) {
			onScrollEnd && onScrollEnd();
			return;
		}

		var p = getPos(ev);
		var v0 = (p[1]-m.y0) / duration;
		if (v0 == 0) {
			onScrollEnd && onScrollEnd();
			return;
		}

		v0 *= 2.5;
		var deceleration = 0.0005;

		window.requestAnimationFrame(moveNext);
		function moveNext() 
		{
			// 用户有新的点击，则取消动画
			if (touchev_ != null)
				return;

			var dt1 = new Date();
			var t = dt1 - dt;
			dt = dt1;
			var s = v0 * t / 2;
			var dir = v0<0? -1: 1;
			v0 -= deceleration * t * dir;
			// 变加速运动
			deceleration *= 1.1;

			var top = cont_.scrollTop;
			cont_.scrollTop = top - s;
			if (v0 * dir > 0 && top != cont_.scrollTop) {
				window.requestAnimationFrame(moveNext);
			}
			else {
				onScrollEnd && onScrollEnd();
			}
		}
	}

	function touchEnd(ev)
	{
		updateHint(null, 0);
		if (touchev_ == null || touchev_.ac == null || Math.abs(touchev_.pully) < opt_.threshold)
		{
			momentumScroll(ev, onScrollEnd);
			touchev_ = null;
			return;
		}
		console.log(touchev_);
		doAction(touchev_.ac);
		touchev_ = null;

		function doAction(ac)
		{
			// pulldown
			if (ac == "D") {
				console.log("refresh");
				opt_.onLoadItem.call(cont_, true);
			}
			else if (ac == "U") {
				console.log("load more");
				opt_.onLoadItem.call(cont_, false);
			}
		}

		function onScrollEnd()
		{
			if (opt_.autoLoadMore && dy_ < -20) {
				var distanceToBottom = cont_.scrollHeight - cont_.clientHeight - cont_.scrollTop;
				if (distanceToBottom <= TRIGGER_AUTOLOAD) {
					doAction("U");
				}
			}
		}
	}
}

/**
@fn initPageList(jpage, opt) -> PageListInterface
@alias initNavbarAndList

列表页逻辑框架.

对一个导航栏(class="mui-navbar")及若干列表(class="p-list")的典型页面进行逻辑封装；也可以是若干button对应若干div-list区域，一次只显示一个区域；
特别地，也可以是只有一个list，并没有button或navbar对应。

它包括以下功能：

1. 首次进入页面时加载默认列表
2. 任一列表支持下拉刷新，上拉加载（自动管理刷新和分页）
3. 点击导航栏自动切换列表，仅当首次显示列表时刷新数据
4. 支持强制刷新所有列表的控制，一般定义在page接口中，如 PageOrders.refresh

## 例：一个navbar与若干list的组合

基本页面结构如下：

	<div mui-initfn="initPageOrders" mui-script="orders.js">
		<div class="hd">
			<h2>订单列表</h2>
			<div class="mui-navbar">
				<a href="javascript:;" class="active" mui-linkto="#lst1">待服务</a>
				<a href="javascript:;" mui-linkto="#lst2">已完成</a>
			</div>
		</div>

		<div class="bd">
			<div id="lst1" class="p-list active" data-cond="status='PA'"></div>
			<div id="lst2" class="p-list" data-cond="status='RE'"></div>
		</div>
	</div>

上面页面应注意：

- navbar在header中，不随着滚动条移动而改变位置
- 默认要显示的list应加上active类，否则自动取第一个显示列表。
- mui-navbar在点击一项时，会在对应的div组件（通过被点击的<a>按钮上mui-linkto属性指定链接到哪个div）添加class="active"。非active项会自动隐藏。

js调用逻辑示例：

	var lstItf = initPageList(jpage, {
		pageItf: PageOrders,

		//以下两项是缺省值：
		//navRef: ">.hd .mui-navbar",
		//listRef: ">.bd .p-list",
		
		// 设置查询参数，静态值一般通过在列表对象上设置属性 data-ac, data-cond以及data-queryParam等属性来指定更方便。
		onGetQueryParam: function (jlst, queryParam) {
			queryParam.ac = "Ordr.query";
			queryParam.orderby = "id desc";
			// queryParam.cond 已在列表data-cond属性中指定
		},
		onAddItem: function (jlst, itemData) {
			var ji = $("<li>" + itemData.title + "</li>");
			ji.appendTo(jlst);
		},
		onNoItem: function (jlst) {
			var ji = $("<li>没有订单</li>");
			ji.appendTo(jlst);
		}
	});

由于指定了pageItf属性，当外部页面设置了 PageOrders.refresh = true后，再进入本页面，所有关联的列表会在展现时自动刷新。且PageOrders.refresh会被自动重置为false.

## 例：若干button与若干list的组合

一个button对应一个list; 打开页面时只展现一个列表，点击相应按钮显示相应列表。

如果没有用navbar组件，而是一组button对应一组列表，点一个button显示对应列表，也可以使用本函数。页面如下：

	<div mui-initfn="initPageOrders" mui-script="orders.js">
		<div class="hd">
			<h2>订单列表</h2>
		</div>

		<div class="bd">
			<div class="p-panelHd">待服务</div>
			<div class="p-panel">
				<div id="lst1" class="p-list active"></div>
			</div>

			<div class="p-panelHd">已完成</div>
			<div class="p-panel">
				<div id="lst2" class="p-list"></div>
			</div>
		</div>
	</div>

js调用逻辑示例：

	jpage.find(".p-panel").height(500); // !!! 注意：必须为list container指定高度，否则无法出现下拉列表。一般根据页高自动计算。

	var lstItf = initPageList(jpage, {
		pageItf: PageOrders,
		navRef: ".p-panelHd", // 点标题栏，显示相应列表区
		listRef: ".p-panel .p-list", // 列表区
		...
	});

注意：navRef与listRef中的组件数目一定要一一对应。除了使用选择器，也可以直接用jQuery对象为navRef和listRef赋值。

## 例：只有一个list

只有一个list 的简单情况，也可以调用本函数简化分页处理.
仍考虑上例，假如那两个列表需要进入页面时就同时显示，那么可以分开一一设置如下：

	jpage.find(".p-panel").height(500); // 一定要为容器设置高度

	var lstItf = initPageList(jpage, {
		pageItf: PageOrders,
		navRef: "", // 置空，表示不需要button链接到表，下面listRef中的多表各自显示不相关。
		listRef: ".p-panel .p-list", // 列表区
		...
	});

上例中，listRef参数也可以直接使用jQuery对象赋值。
navRef是否为空的区别是，如果非空，则表示listRef是一组互斥的列表，点击哪个button，就会设置哪个列表为active列表。当切到当前页时，只显示或刷新active列表。

如果是只包含一个列表的简单页面：

	<div mui-initfn="initPageOrders" mui-script="orders.js">
		<div class="hd">
			<h2>订单列表</h2>
		</div>

		<div class="bd">
			<div class="p-list"></div>
		</div>
	</div>

由于bd对象的高度已自动设置，要设置p-list对象支持上下拉加载，可以简单调用：

	var lstItf = initPageList(jpage, {
		pageItf: PageOrders,
		navRef: "", // 一定置空，否则默认值是取mui-navbar
		listRef: ".p-list"
		...
	});

## 框架基本原理

原理是在合适的时机，自动调用类似这样的逻辑：

	var queryParam = {ac: "Ordr.query"};
	opt.onGetQueryParam(jlst, queryParam);
	callSvr(queryParam.ac, queryParam, function (data) {
		$.each(rs2Array(data), function (i, itemData) {
			opt.onAddItem(jlst, itemData);
		});
		if (data.d.length == 0)
			opt.onNoItem(jlst);
	});

## 参数说明

@param opt {onGetQueryParam?, onAddItem?, onNoItem?, pageItf?, navRef?=">.hd .mui-navbar", listRef?=">.bd .p-list", onBeforeLoad?, onLoad?, onGetData?, canPullDown?=true, onRemoveAll?}
@param opt 分页相关 { pageszName?="_pagesz", pagekeyName?="_pagekey" }

@param opt.onGetQueryParam Function(jlst, queryParam/o)

queryParam: {ac?, res?, cond?, ...}

框架在调用callSvr之前，先取列表对象jlst上的data-queryParam属性作为queryParam的缺省值，再尝试取data-ac, data-res, data-cond, data-orderby属性作为queryParam.ac等参数的缺省值，
最后再回调 onGetQueryParam。

	<ul data-queryParam="{q: 'famous'}" data-ac="Person.query" data-res="*,familyName" data-cond="status='PA' and name like '王%'">
	</ul>

此外，框架将自动管理 queryParam._pagekey/_pagesz 参数。

@param opt.onAddItem (jlst, itemData, param)

param={idx, arr, isFirstPage}

框架调用callSvr之后，处理每条返回数据时，通过调用该函数将itemData转换为DOM item并添加到jlst中。
判断首页首条记录，可以用

	param.idx == 0 && param.isFirstPage

这里无法判断是否最后一页（可在onLoad回调中判断），因为有可能最后一页为空，这时无法回调onAddItem.

@param opt.onNoItem (jlst)

当没有任何数据时，可以插入提示信息。

@param opt.pageItf - page interface {refresh?/io}

在订单页面(PageOrder)修改订单后，如果想进入列表页面(PageOrders)时自动刷新所有列表，可以设置 PageOrders.refresh = true。
设置opt.pageItf=PageOrders, 框架可自动检查和管理refresh变量。

@param opt.navRef,opt.listRef  指定navbar与list，可以是选择器，也可以是jQuery对象；或是一组button与一组div，一次显示一个div；或是navRef为空，而listRef为一个或多个不相关联的list.

@param opt.onBeforeLoad(jlst, isFirstPage)->Boolean  如果返回false, 可取消load动作。参数isFirstPage=true表示是分页中的第一页，即刚刚加载数据。
@param opt.onLoad(jlst, isLastPage)  参数isLastPage=true表示是分页中的最后一页, 即全部数据已加载完。

@param opt.onGetData(data, pagesz, pagekey?) 每次请求获取到数据后回调。pagesz为请求时的页大小，pagekey为页码（首次为null）

@param opt.onRemoveAll(jlst) 清空列表操作，默认为 jlst.empty()

@return PageListInterface={refresh, markRefresh, loadMore}

- refresh: Function(), 刷新当前列表
- markRefresh: Function(jlst?), 刷新指定列表jlst或所有列表(jlst=null), 下次浏览该列表时刷新。
- loadMore: Function(), 加载下一页数据

## css类

可以对以下两个CSS class指定样式：

@key mui-pullPrompt CSS-class 下拉刷新提示块
@key mui-loadPrompt CSS-class 自动加载提示块

## 列表页用于选择

@key example-list-choose

常见需求：在一个页面上，希望进入另一个列表页，选择一项后返回。

可定义页面接口如下（主要是choose方法和onChoose回调）：

	var PageOrders = {
		...
		// onChoose(order={id,dscr,...})
		choose: function (onChoose) {
			this.chooseOpt_ = {
				onChoose: onChoose
			}
			MUI.showPage('#orders');
		},

		chooseOpt_: null // {onChoose}
	};

在被调用页面上：

- 点击一个列表项时，调用onChoose回调
- 页面隐藏时，清空chooseOpt_参数。

示例：

	function initPageOrders()
	{
		jpage.on("pagehide", onPageHide);

		function li_click(ev)
		{
			var order = $(this).data('obj');
			if (PageOrders.chooseOpt_) {
				PageOrders.chooseOpt_.onChoose(order);
				return false;
			}

			// 正常点击操作 ...
		}

		function onPageHide()
		{
			PageOrders.chooseOpt_ = null;
		}
	}

在调用时：

	PageOrders.choose(onChoose);

	function onChoose(order)
	{
		// 处理order
		history.back(); // 由于进入列表选择时会离开当前页面，这时应返回
	}

## 分页机制与后端接口适配

默认按BQP协议的分页机制访问服务端，其规则是：

- 请求通过 _pagesz 参数指定页大小
- 如果不是最后一页，服务端应返回nextkey字段；返回列表的格式可以是 table格式如 

		{
			h: [ "field1","field2" ],
			d: [ ["val1","val2"], ["val3","val4"], ... ]
			nextkey: 2
		}

	也可以用list参数指定列表，如

		{
			list: [
				{field1: "val1", field2: "val2"},
				{field1: "val3", field2: "val4"},
			],
			nextkey: 2
		}

- 请求下一页时，设置参数_pagekey = nextkey，直到服务端不返回 nextkey 字段为止。

例1：假定后端分页机制为(jquery-easyui datagrid分页机制):

- 请求时通过参数page, rows分别表示页码，页大小，如 `page=1&rows=20`
- 返回数据通过字段total表示总数, rows表示列表数据，如 `{ total: 83, rows: [ {...}, ... ] }`

适配方法为：

	var listItf = initPageList(jpage, {
		...

		pageszName: 'rows',
		pagekeyName: 'page',

		// 设置 data.list, data.nextkey (如果是最后一页则不要设置); 注意pagekey可以为空
		onGetData: function (data, pagesz, pagekey) {
			data.list = data.rows;
			if (pagekey == null)
				pagekey = 1;
			if (data.total >  pagesz * pagekey)
				data.nextkey = pagekey + 1;
		}
	});

@key initPageList.options initPageList默认选项

如果需要作为全局默认设置可以这样：

	$.extend(initPageList.options, {
		pageszName: 'rows', 
		...
	});

例2：假定后端分页机制为：

- 请求时通过参数curPage, maxLine分别表示页码，页大小，如 `curPage=1&maxLine=20`
- 返回数据通过字段curPage, countPage, investList 分别表示当前页码, 总页数，列表数据，如 `{ curPage:1, countPage: 5, investList: [ {...}, ... ] }`

	var listItf = initPageList(jpage, {
		...

		pageszName: 'maxLine',
		pagekeyName: 'curPage',

		// 设置 data.list, data.nextkey (如果是最后一页则不要设置); 注意pagekey可以为空
		onGetData: function (data, pagesz, pagekey) {
			data.list = data.investList;
			if (data.curPage < data.countPage)
				data.nextkey = data.curPage + 1;
		}
	});

例3：假定后端就返回一个列表如`[ {...}, {...} ]`，不支持分页。
什么都不用设置，仍支持下拉刷新，因为刚好会当成最后一页处理，上拉不再加载。

## 下拉刷新提示信息

@key .mui-pullHint 指定下拉提示显示位置
显示下拉刷新提示时，默认是在列表所在容器的最上端位置显示的。如果需要指定显示位置，可使用css类"mui-pullHint"，示例如下：

	<div class="bd">
		<div>下拉列表演示</div>
		<div class="mui-pullHint"></div> <!-- 如果没有这行，则下拉提示会在容器最上方，即"下拉列表演示"这行文字的上方-->
		<div id="lst1"></div>
		<div id="lst2"></div>
	</div>

## 禁止下拉和上拉行为

例：在多页列表中，有一些页只做静态展示使用，不需要上拉或下拉：

	<div mui-initfn="initPageOrders" mui-script="orders.js">
		<div class="hd">
			<h2>订单列表</h2>
			<div class="mui-navbar">
				<a href="javascript:;" class="active" mui-linkto="#lst1">待服务</a>
				<a href="javascript:;" mui-linkto="#lst2">已完成</a>
				<a href="javascript:;" mui-linkto="#lst3">普通页</a>
			</div>
		</div>

		<div class="bd">
			<div id="lst1" class="p-list active" data-cond="status='PA'"></div>
			<div id="lst2" class="p-list" data-cond="status='RE'"></div>
			<div id="lst3" class="mui-noPull">
				<p>本页面没有下拉加载或上拉刷新功能</p>
			</div>
		</div>
	</div>

例子中使用了类"mui-noPull"来标识一个TAB页不是列表页，无需分页操作。

@key .mui-noPull 如果一个列表页项的class中指定了此项，则显示该列表页时，不允许下拉。

还可以通过设置onPull选项来灵活设置，例：

	var listItf = initPageList(jpage, ...,
		onPull(ev, jlst) {
			if (jlst.attr("id") == "lst3")
				return false;
		}
	);

@param opt.onPull function(ev, jlst)

jlst:: 当前活动页。函数如果返回false，则取消所有上拉加载或下拉刷新行为，使用系统默认行为。

## 仅自动加载，禁止下拉刷新行为

有时不想为列表容器指定固定高度，而是随着列表增长而自动向下滚动，在滚动到底时自动加载下一页。
这时可禁止下拉刷新行为：

	var listItf = initPageList(jpage, 
		...,
		canPullDown: false,
	);

@param opt.canPullDown?=true  是否允许下拉刷新

设置为false时，当列表到底部时，可以自动加载下一页，但没有下拉刷新行为，这时页面容器也不需要确定高度。

 */
self.initPageList = initPageList;
function initPageList(jpage, opt)
{
	var opt_ = $.extend({}, initPageList.options, opt);
	var jallList_ = opt_.listRef instanceof jQuery? opt_.listRef: jpage.find(opt_.listRef);
	var jbtns_ = opt_.navRef instanceof jQuery? opt_.navRef: jpage.find(opt_.navRef);
	var firstShow_ = true;
	var busy_ = false;

	if (jbtns_.hasClass("mui-navbar")) {
		jbtns_ = jbtns_.find("a");
	}
	else {
		linkNavbarAndList(jbtns_, jallList_);
	}
	if (jallList_.size() == 0)
		throw "bad list";

	init();

	function linkNavbarAndList(jbtns, jlsts)
	{
		jbtns.each(function (i, e) {
			$(e).data("linkTo", jlsts[i]);
		});
		jbtns.click(function () {
			jlsts.removeClass("active");

			var lst = $(this).data("linkTo");
			$(lst).addClass("active");
		});
	}

	function init()
	{
		jpage.on("pagebeforeshow", pagebeforeshow);

		function pagebeforeshow()
		{
			if (opt_.pageItf && opt_.pageItf.refresh) {
				jallList_.data("nextkey_", null);
				opt_.pageItf.refresh = false;
				firstShow_ = true;
			}
			if (firstShow_ ) {
				showOrderList(false, false);
			}
		}

		jbtns_.click(function (ev) {
			// 让系统先选中tab页再操作
			setTimeout(function () {
				showOrderList(false, true);
			});
		});

		if (opt_.canPullDown) {
			var pullListOpt = {
				onLoadItem: showOrderList,
				//onHint: $.noop,
				onHintText: onHintText,
				onPull: function (ev) {
					var jlst = getActiveList();
					if (jlst.is(".mui-noPull") || 
						(opt_.onPull && opt_.onPull(ev, jlst) === false)) {
						return false;
					}
				}
			};

			jallList_.parent().each(function () {
				var container = this;
				initPullList(container, pullListOpt);
			});
		}
		else {
			jallList_.parent().scroll(function () {
				var container = this;
				//var distanceToBottom = cont_.scrollHeight - cont_.clientHeight - cont_.scrollTop;
				if (! busy_ && container.scrollTop / (container.scrollHeight - container.clientHeight) >= 0.95) {
					console.log("load more");
					loadMore();
				}
			});
		}

		// 如果调用init时页面已经显示，则补充调用一次。
		if (MUI.activePage && MUI.activePage.attr("id") == jpage.attr("id")) {
			pagebeforeshow();
		}
	}

	// return jlst. (caller need check size>0)
	function getActiveList()
	{
		if (jallList_.size() <= 1)
			return jallList_;
		var jlst = jallList_.filter(".active");
		if (jlst.size() == 0)
			jlst = jallList_.filter(":first");
		return jlst;
	}

	function onHintText(ac, uptoThreshold)
	{
		if (ac == "D") {
			var jlst = getActiveList();
			if (jlst.size() == 0)
				return;

			var tm = jlst.data("lastUpdateTm_");
			if (! tm)
				return;
			var diff = mCommon.getTimeDiffDscr(tm, new Date());
			var str = diff + "刷新";
			if (uptoThreshold) {
				msg = "<b>" + str + "~~~</b>";
			}
			else {
				msg = str;
			}
			return msg;
		}
	}

	// (isRefresh?=false, skipIfLoaded?=false)
	function showOrderList(isRefresh, skipIfLoaded)
	{
		// nextkey=null: 新开始或刷新
		// nextkey=-1: 列表完成
		var jlst = getActiveList();
		if (jlst.is(".mui-noPull"))
			return;
		if (jlst.size() == 0)
			return;

		if (busy_) {
			var tm = jlst.data("lastCallTm_");
			if (tm && new Date() - tm <= 5000)
			{
				console.log('!!! ignore duplicated call');
				return;
			}
			// 5s后busy_标志还未清除，则可能是出问题了，允许不顾busy_标志直接进入。
		}

		var nextkey = jlst.data("nextkey_");
		if (isRefresh) {
			nextkey = null;
		}
		if (nextkey == null) {
			opt_.onRemoveAll(jlst); // jlst.empty();
		}
		else if (nextkey === -1)
			return;

		if (skipIfLoaded && nextkey != null)
			return;

		var queryParam = self.evalAttr(jlst, "data-queryParam") || {};
		$.each(["ac", "res", "cond", "orderby"], function () {
			var val = jlst.attr("data-" + this);
			if (val)
				queryParam[this] = val;
		});

		if (opt_.onBeforeLoad) {
			var rv = opt_.onBeforeLoad(jlst, nextkey == null);
			if (rv === false)
				return;
		}

		if (opt_.onGetQueryParam) {
			opt_.onGetQueryParam(jlst, queryParam);
		}

		if (!queryParam[opt_.pageszName])
			queryParam[opt_.pageszName] = MUI.options.PAGE_SZ; // for test, default 20.
		if (nextkey)
			queryParam[opt_.pagekeyName] = nextkey;

		var loadMore_ = !!nextkey;
		var joLoadMore_;
		if (loadMore_) {
			if (joLoadMore_ == null) {
				joLoadMore_ = $("<div class='mui-loadPrompt'>正在加载...</div>");
			}
			joLoadMore_.appendTo(jlst);
			// scroll to bottom
			var cont = jlst.parent()[0];
			cont.scrollTop = cont.scrollHeight;
		}
		else {
			jlst.data("lastUpdateTm_", new Date());
		}
		jlst.data("lastCallTm_", new Date());
		busy_ = true;
		var ac = queryParam.ac;
		mCommon.assert(ac != null, "*** queryParam `ac` is not defined");
		delete queryParam.ac;
		self.callSvr(ac, queryParam, api_OrdrQuery);

		function api_OrdrQuery(data)
		{
			busy_ = false;
			firstShow_ = false;
			if (loadMore_) {
				joLoadMore_.remove();
			}
			if (opt_.onGetData) {
				var pagesz = queryParam[opt_.pageszName];
				var pagekey = queryParam[opt_.pagekeyName];
				opt_.onGetData(data, pagesz, pagekey);
			}
			var arr = data;
			if ($.isArray(data.h) && $.isArray(data.d)) {
				arr = mCommon.rs2Array(data);
			}
			else if ($.isArray(data.list)) {
				arr = data.list;
			}
			mCommon.assert($.isArray(arr), "*** initPageList error: no list!");

			var isFirstPage = (nextkey == null);
			var isLastPage = (data.nextkey == null);
			var param = {arr: arr, isFirstPage: isFirstPage};
			$.each(arr, function (i, itemData) {
				param.idx = i;
				opt_.onAddItem && opt_.onAddItem(jlst, itemData, param);
			});
			if (! isLastPage)
				jlst.data("nextkey_", data.nextkey);
			else {
				if (jlst[0].children.length == 0) {
					opt_.onNoItem && opt_.onNoItem(jlst);
				}
				jlst.data("nextkey_", -1);
			}
			opt_.onLoad && opt_.onLoad(jlst, isLastPage);
		}
	}

	function refresh()
	{
		// (isRefresh?=false, skipIfLoaded?=false)
		showOrderList(true, false);
	}

	function loadMore()
	{
		// (isRefresh?=false, skipIfLoaded?=false)
		showOrderList(false);
	}

	function markRefresh(jlst)
	{
		if (jlst)
			jlst.data("nextkey_", null);
		else
			jallList_.data("nextkey_", null);
	}

	var itf = {
		refresh: refresh,
		markRefresh: markRefresh,
		loadMore: loadMore,
	};
	return itf;
}

initPageList.options = {
	navRef: ">.hd .mui-navbar",
	listRef: ">.bd .p-list",
	pageszName: "_pagesz",
	pagekeyName: "_pagekey",
	canPullDown: true,
	onRemoveAll: function (jlst) {
		jlst.empty();
	}
};

}
