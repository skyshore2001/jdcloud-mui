# jdcloud-mui 筋斗云移动端单页应用框架

jdcloud-mui是用于创建手机H5单页应用的技术框架，它倡导使用纯粹的单页应用框架加模块化开发，主H5页面只是空的框架，实际内容存在于每个逻辑页模块。

把“单网页应用”技术应用到手机上，让整个应用就是一个网页，而原本一张张相互链接的网页变成了H5应用中的一个个可流畅切换的逻辑页面，消除了网页加载，操作体验接近手机原生应用。

这种支持多逻辑页面的具有流畅的操作体验的H5单网页应用，我们将它称为**变脸式应用**。

这些模块遵守“**页面对象模型(POM)**”，从而可以像搭积木一样构建起应用，在制作复杂的手机应用时也可得心应手。

jdcloud-mui以页面路由和接口调用为核心，提供多逻辑页支持和远程接口调用封装，同时对制作安卓、苹果原生应用也提供良好的支持，因而也是一个全平台H5应用框架。
对于手机应用中常用下拉刷新、自动分页、自动加载等功能，框架将其抽象为**列表页设计模式**，使得编程大为简化。类似的还有“详情页设计模式”，可在一个逻辑页完成对象的添加、展示和更新操作。

它默认使用“**业务查询协议(BQP)**”与后端服务接口通讯，如果后端服务接口不符合该协议，则需要设置接口适配。
筋斗云后端框架可开发符合业务查询协议的接口，推荐搭配使用，可以使用以下开源框架实现筋斗云后端服务：

- jdclud-php (筋斗云后端php版本)
- jdclud-java (筋斗云后端java版本)
- jdclud-cs (筋斗云后端.net版本)

相关的开源框架：

- 筋斗云前端项目模板`jdcloud-m`，其核心就是使用`jdcloud-mui`库，并添加了编译优化、发布与持续集成、原生手机应用支持等实用工具，如果是新项目，推荐直接以`jdcloud-m`作为初始项目模板。
- 如果要创建电脑上使用的H5应用程序（如创建管理端应用），可以使用筋斗云管理端单页应用框架`jdcloud-wui`.

## 使用方法

lib目录包含框架的主程序 lib/jdcloud-mui.js (相应的压缩版本为lib/jdcloud-mui.min.js)以及它依赖的库jQuery等。
将它们复制到你们项目中即可。

在example目录下是一个通用订单应用的示例，可以直接在浏览器中运行。

下面的章节带你大致了解jdcloud-mui框架编程风格。对于更多常见需求的解决方案及函数用法，可以参考文档 jdcloud-mui.html。

注意：筋斗云的核心是页面路由(showPage)和接口调用(callSvr)，它自身不提供移动UI样式库。

在示例应用中，通过集成weui样式库来提供手机UI样式。
weui是一套同微信原生视觉体验一致的基础样式库，由微信官方团队开发，关于weui的使用可以参考https://weui.io/或自行搜索。
当然你也可以把它换成你自己喜欢的任何UI库。

## 框架页

在示例应用中，index.html为框架页，大致如下：

	引入jquery等依赖库...
	引入jdcloud-mui库：<script src="../lib/jdcloud-mui.min.js"></script>
	引入h5应用自身逻辑，如 index.js

	引入模拟接口数据：在没有后端服务时，框架支持模拟接口数据。正式上线时应删除。
	<script src="mockdata.js"></script>

	<body class="mui-container">

	<!-- footer -->
	<div id="footer">
		<a href="#home" mui-opt="ani:'none'">
			<!--span class="icon icon-home"></span-->
			<span>首页</span>
		</a>
		<a href="#orders" mui-opt="ani:'none'">
			<span>订单</span>
		</a>
		<a href="#me" mui-opt="ani:'none'">
			<span>我</span>
		</a>
	</div>

	</body>

一般在body组件上添加class="mui-container"，表示页面都将显示在这里，在程序中可以用`MUI.container`来获取到这个对象。

逻辑页以外部模块的方式在外部page目录中定义，使用时以ajax方式动态加载。
在page目录下，可以看到很多 XXX.html/js文件，这便是逻辑页模块。

如果不想在运行时动态加载外部模块，可在发布时通过打包工具(webcc)将部分常用模块或全部模块打包进框架页，这样可兼顾开发和运行效率。

## 逻辑页

我们制作一个仅显示"hello world"的逻辑页面。

制作一个逻辑页面，存到文件page/hello.html:

	<div>
		<div class="hd">
			<h2>HelloWorld</h2>
		</div>

		<div class="bd">
			<p>Hello, world</p>
		</div>
	</div>

这是个html片段，其中`class="hd"`与`class="bd"`分别代表逻辑页的标题栏和主体部分。一般应保持这样的结构，即使不需要标题栏，也建议保留hd这个div，将其设置隐藏即可(`style="display:none"`)。

如果要进入该逻辑页，可以调用`MUI.showPage`函数：

	MUI.showPage("#hello");

showPage函数会按需动态加载逻辑页，一旦从外部加载到页面，则会自动为它设置id为页面名，如上例中会添加`id="hello"`。

也可以通过链接，如在首页page/home.html中添加一个链接过来：

	...
	<div class="bd">
		...
		<li><a href="#hello">Hello</a></li>
	</div>

点击链接，即可进行该页。点击浏览器的返回按钮，可以回到首页。在返回时，没有网页刷新的过程，这也是变脸式应用的典型特点。

如果想为逻辑页添加一些样式，且样式只在这个逻辑页中生效，则直接在页面内嵌入样式：

	<div>
		<style>
		p {
			color: red;
		}
		</style>

		<div class="hd"> ... </div>
		<div class="bd"> ... </div>
	</div>

**jdcloud-mui支持自动限定逻辑页样式作用域。** 框架在动态加载该页时，会限制这个样式只会用于当前逻辑页，不会污染到其它页面。

上面修改逻辑页后，不必刷新整个H5应用，可以在控制台上直接运行：

	MUI.reloadPage();

就可以直接查看到更新后的逻辑页了。这称为**逻辑页热更新技术**，这一技巧在开发调试逻辑页时非常好用。

假如一个复杂的应用场景中，你需要做10步操作才能进入一个逻辑页，发现了bug并修正好，你不必刷新页面再重复前面的10步操作，而是直接用热更新就可立即检查更改后的结果。
因为网页刷新会使应用状态（js全局变量等）丢失，而热更新则不会破坏应用状态。

类似的技巧还有卸载一个逻辑页，以便再进入时可重新初始化：

	MUI.unloadPage(); // 卸载当前页
	MUI.unloadPage("hello"); // 卸载指定页

为逻辑页增加js逻辑的方法如下：
```html
<div mui-initfn="initPageHello" mui-script="hello.js">
	<div class="hd">
		<h2>HelloWorld</h2>
	</div>

	<div class="bd">
		<p>Hello, world</p>
	</div>

</div>
```

在逻辑页上通过`mui-script`属性指定了js文件，通过`mui-initfn`属性指定了页面初始化函数。

创建`page/hello.js`文件如下：
```javascript
function initPageHello() 
{
	var jpage = $(this);
	jpage.on("pagebeforeshow", onBeforeShow);
	jpage.on("pagehide", onHide);

	function onBeforeShow()
	{
		app_alert("before show");
	}
	function onHide()
	{
		app_alert("hide");
	}
}
```
上面演示了逻辑页进入和退出时常用的事件处理，很容易理解。
一般从后端取数据的操作都习惯放在pagebeforeshow事件中处理。另外还有pageshow, pagecreate等事件。

`app_alert`是框架提供的异步弹出框函数，可用于提示消息(类似alert)、确认消息(类似confirm)、问询消息(类似prompt)等。

## 调用后端接口

继续hello页面的例子，要求每次进入页面时，不是固定的显示"hello, world"，而是需要根据服务端的返回内容来显示hello的内容，比如"hello, skys"或是"hello, jdcloud"。

我们先定义一个叫做"hello"的交互接口，由前端发起一个HTTP GET请求，比如：

	http://myserver/myproject/api.php?ac=hello

如果调用成功，后端返回JSON格式的数据如下：

	[0, "jdcloud"]

其中0是返回码，表示调用成功。如果调用失败，可返回：

	[99, "对不起，服务器爆炸了"]

以上就是一个符合筋斗云接口规范的简单例子（称为业务查询协议-BQP），在成功调用时应返回`[0, data]`，在调用失败时应返回`[非0, 错误提示信息]`。

有了清晰的接口定义，前后端就可以并行开发了。
在前端，我们把页面稍作修改以动态显示hello的内容：
```html
	<div class="bd">
		<p>Hello, <span id="what"></span></p>
	</div>
```
再写一段逻辑，每当进入页面时调用hello接口并显示内容，我们选择onBeforeShow回调来做这件事：
```javascript
function initPageHello() 
{
	var jpage = $(this);
	jpage.on("pagebeforeshow", onBeforeShow);

	function onBeforeShow()
	{
		callSvr("hello", api_hello);
	}

	function api_hello(data)
	{
		jpage.find("#what").html(data);
	}
}
```
`callSvr`是框架提供的一个重要函数，它封装了ajax调用的细节，完整的函数原型为：

	callSvr(ac, param?, fn?, postParam?, options?);

其中，ac是调用接口名，fn是回调函数，param和postParam分别是URL参数和POST参数。除ac外，其它参数均可省略。例如

	callSvr("hello");
	callSvr("hello", {id: 1}); // URL: hello?id=1
	callSvr("hello", {id: 1}, api_hello); // function api_hello(data) {}
	callSvr("hello", api_hello, {name: "hello"});

回调函数api_hello仅在成功时被调用，参数data是实际数据，即`[0, data]`中的data部分，不包括返回码0。
当调用失败时，框架会统一处理，显示错误信息，无须操心。

### 调用模拟接口

上面代码写好了，后端接口还没做好怎么测试？

**筋斗云支持模拟接口返回数据。** 在mockdata.js中，可以设置接口的模拟返回数据：

	MUI.mockData = {
		...
		"hello": [0, "jdcloud"]
	}

此处还可以用函数做更复杂的基于参数的模拟，详见API文档，查询`MUI.mockData`。

运行H5应用，进入hello页面，看看是不是可以正常显示了？

可以动态修改模拟数据，在控制台中输入：

	MUI.mockData["hello"] = [0, "skys"]

然后从hello页返回首页，再进入hello页，看看显示内容是不是变了？

再改一个出错的试试：

	MUI.mockData["hello"] = [99, "对不起，服务器爆炸了"]

进入hello页，我们看到，调用失败时，回调函数api_hello没有执行，而是框架自动接管过去，显示出错信息。

### 调用真实接口

在后端接口开发好后，我们可去掉对这个接口的模拟，直接远程调用服务端接口。这需要配置好后端接口的地址。

我们用php写一个简单的符合筋斗云接口规范的后端实现，通过名为"ac"的URL参数表示接口名，在server目录中创建文件api.php如下：
```php
<?php

@$ac = $_GET['ac'];
if ($ac == 'hello') {
	$what = "jdcloud @ " . time();
	echo json_encode([0, $what]);
}
else {
	echo json_encode([1, "bad ac"]);
}
```

配置好php的调用环境后，访问

	http://localhost/myproject/api.php?ac=hello

输出类似这样（根据时间动态变化）：

	[0,"jdcloud @ 1483526151"]

回到前端，我们在app.js中设置服务端接口地址：
```javascript
	$.extend(MUI.options, {
		serverUrl: "api.php",
		serverUrlAc: "ac"
	});
```
serverUrl选项设置了服务端的URL地址，因为我们将"api.php"放在与"index.html"同一目录下，所以直接用相对路径就可以了。serverUrlAc选项定义了接口名对应的URL参数名称，即`?ac={接口名}`.
在mockdata.js中去掉对"hello"接口的模拟，刷新应用就可以看到调用后端的效果了。

如果前后端不在同一台服务器上，则要将URL写完整，如

	serverUrl: "http://myserver/myproject/api.php";

注意：后端应设置好允许跨域请求。这里不做详述。

以上讲述的是符合筋斗云接口规范的接口调用设置，如果不符合该规范，请阅读下一节“接口适配”。

### 接口适配

在上例中，假定了后端接口兼容筋斗云接口规范，例如返回格式为`[0, jsonData]`及`[非0, 错误信息]`。
如果接口协议不兼容，则需要做接口适配。

接口适配的目标是通过`callSvr`函数更加简练地调用后台接口，同时达到：

- 调用出错统一处理，例如未认证错跳转到登录页，其它错误弹出错误提示框等。
- 写代码时只需要处理调用成功后返回的数据，不用每次调用都处理各种错误。

**[任务]**

适配以下接口协议规范，约定接口返回格式为：`{code, msg, data}`，
例如上例中的hello接口，调用成功时返回：

	{
		"code":"0",
		"msg":"success",
		"data":"jdcloud"
	}

失败返回：

	{
		"code":"99",
		"msg":"对不起，服务器爆炸了"
	}

这时需要对callSvr进行适配，可以在app.js中，设置 `MUI.callSvrExt`如下:
```javascript
	MUI.callSvrExt['default'] = {
		makeUrl: function(ac) {
			return 'http://hostname/lcapi/' + ac;
		},
		dataFilter: function (data) {
			if ($.isPlainObject(data) && data.code !== undefined) {
				if (data.code == 0)
					return data.data;
				if (this.noex)
					return false;
				app_alert("操作失败：" + data.msg, "e");
			}
			else {
				app_alert("服务器通讯协议异常!", "e"); // 格式不对
			}
		}
	};
```

我们在mockdata.js中设置好模拟数据用于测试：

	MUI.mockData = {
		"User.get": {code: 0, msg: "success", data: user},
		"hello": {code: 0, msg: "success", data:"myworld"}
		...
	}

上例中，`User.get`接口在显示首页是会调用，所以和"hello"接口一并模拟下。

测试接口调用：

	callSvr("hello", console.log);
	或
	callSvrSync("hello");

`callSvrSync`是`callSvr`的同步调用版本，它直接等到调用完成才返回，且返回值就是调用成功返回的数据。

可以动态修改模拟数据：

	MUI.mockData["hello"] = {code: 99, msg: "对不起，服务器爆炸了"}

在接口适配完成后，应用层代码不用去做任何修改。
进入页面看看，是不是和上节的运行结果是一样的。

