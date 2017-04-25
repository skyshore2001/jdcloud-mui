jdModule("jdcloud.mui", JdcloudDetailPage);
function JdcloudDetailPage()
{
var self = this;
var mCommon = jdModule("jdcloud.common");

/**
@var FormMode

FormMode.forAdd/forSet/forFind.

TODO: example
 */
window.FormMode = {
	forAdd: "A",
	forSet: "S",
	//forView: "V",
	forFind: "F"
};

/**
@fn showByFormMode(jo, formMode)

根据当前formMode自动显示或隐藏jo下的DOM对象.

示例: 对以下DOM对象

	<div id="div1">
		<div id="div2"></div>
		<div id="div3" class="forAdd"></div>
		<div id="div4" class="forSet"></div>
		<div id="div5" class="forSet forAdd"></div>
	</div>

调用showByFormMode(jo, FormMode.forAdd)时, 显示 div2, div3, div5;
调用showByFormMode(jo, FormMode.forSet)时, 显示 div2, div4, div5;
 */
function showByFormMode(jo, formMode)
{
	jo.find(".forSet, .forAdd").each(function () {
		var cls = null;
		if (formMode == FormMode.forSet) {
			cls = "forSet";
		}
		else if (formMode == FormMode.forAdd) {
			cls = "forAdd";
		}
		if (cls)
			$(this).toggle($(this).hasClass(cls));
	});
}

/**
@fn initPageDetail(jpage, opt) -> PageDetailInterface={refresh(), del()}

详情页框架. 用于对象的添加/查看/更新多合一页面.
form.action为对象名.

@param opt {pageItf, jform?=jpage.find("form:first"), onValidate?, onGetData?, onNoAction?=history.back, onAdd?, onSet?, onGet?, onDel?}

pageItf: {formMode, formData}; formData用于forSet模式下显示数据, 它必须有属性id. 
Form将则以pageItf.formData作为源数据, 除非它只有id一个属性(这时将则调用callSvr获取源数据)

onValidate: Function(jform, queryParam); 提交前的验证, 或做字段补全的工作, 或补全调用参数。queryParam是查询参数，它可能包含{ac?, res?, ...}，可以进行修改。
onGetData: Function(jform, queryParam); 在forSet模式下，如果需要取数据，则回调该函数，获取get调用的参数。
onNoAction: Function(jform); 一般用于更新模式下，当没有任何数据更改时，直接点按钮提交，其实不做任何调用, 这时将回调 onNoAction，缺省行为是返回上一页。
onAdd: Function(id); 添加完成后的回调. id为新加数据的编号. 
onSet: Function(data); 更新完成后的回调, data为更新后的数据.
onGet: Function(data); 获取数据后并调用setFormData将数据显示到页面后，回调该函数, 可用于显示特殊数据.
onDel: Function(); 删除对象后回调.

示例：制作一个人物详情页PagePerson：

- 在page里面包含form，form的action属性标明对象名称，method属性不用。form下包含各展示字段，各字段以name属性标识。
- 可以用 forAdd, forSet 等class标识对象只在添加或更新时显示。
- 一个或多个提交按钮，触发提交事件。
- 对于不想展示但需要提交的字段，可以用设置为隐藏的input[type=text]对象，或是input[type=hidden]对象；如果字段会变化应使用前者，type=hidden对象内容设置后不会变化(如调用setFormData不修改hidden对象)

逻辑页面（html片段）示例如下：

	<div mui-initfn="initPagePerson" mui-script="person.js">
		...
		<div class="bd">
			<form action="Person">
				<input name="name" required placeholder="输入名称">
				<textarea name="dscr" placeholder="写点简介"></textarea>
				<div class="forSet">人物标签</div>

				<button type="submit" id="btnOK">确定</button>
				<input type="text" style="display:none" name="familyId">

			</form>
		</div>
	</div>

调用initPageDetail使它成为支持添加、查看和更新的详情页：

	var PagePerson = {
		showForAdd: function (formData) ...
		showForSet: function (formData) ...
	};

	function initPagePerson()
	{
		var jpage = this;
		var pageItf = PagePerson;
		initPageDetail(jpage, {
			pageItf: pageItf, // 需要页面接口提供 formMode, formData等属性。
			onValidate: function (jf) {
				// 补足字段和验证字段，返回false则取消form提交。
				if (pageItf.formMode == FormMode.forAdd) {
					...
				}
			},
			onAdd: function (id) {
				PagePersons.show({refresh: true}); // 添加成功后跳到列表页并刷新。
			},
			onSet: function (data) {
				app_alert("更新成功!", history.back); // 更新成功后提示信息，然后返回前一页。
			},
			onDel: function () {
				PagePersons.show({refresh: true});
			},
		});
	}

	// 其它页调用它：
	PagePerson.showForAdd({familyId: 1}); // 添加人物，已设置familyId为1
	PagePerson.showForSet(person); // 以person对象内容显示人物，可更新。
	PagePerson.showForSet({id: 3}); // 以id=3查询人物并显示，可更新。

对于forSet模式，框架先检查formData中是否只有id属性，如果是，则在进入页面时会自动调用{obj}.get获取数据.

	<form action="Person">
		<div name=familyName></div>
		...
	</form>

如果formData中有多个属性，则自动以formData的内容作为数据源显示页面，不再发起查询。

*/
self.initPageDetail = initPageDetail;
function initPageDetail(jpage, opt)
{
	var pageItf = opt.pageItf;
	if (! pageItf)
		throw("require opt.pageItf");
	var jf = opt.jform || jpage.find("form:first");
	var obj_ = jf.attr("action");
	if (!obj_ || /\W/.test(obj_)) 
		throw("bad object: form.action=" + obj_);

	jpage.on("pagebeforeshow", onPageBeforeShow);

	MUI.setFormSubmit(jf, api_Ordr, {
		validate: onValidate,
		onNoAction: opt.onNoAction || history.back,
	});

	function onValidate(jf, queryParam)
	{
		var ac;
		if (pageItf.formMode == FormMode.forAdd) {
			ac = "add";
		}
		else if (pageItf.formMode == FormMode.forSet) {
			ac = "set";
			queryParam.id = pageItf.formData.id;
		}
		queryParam.ac = obj_ + "." + ac;

		var ret;
		if (opt.onValidate) {
			ret = opt.onValidate(jf, queryParam);
		}
		return ret;
	}

	function api_Ordr(data)
	{
		if (pageItf.formMode == FormMode.forAdd) {
			// 到新页后，点返回不允许回到当前页
			MUI.popPageStack();
			opt.onAdd && opt.onAdd(data);
		}
		else if (pageItf.formMode == FormMode.forSet) {
			var originData = jf.data("origin_");
			$.extend(originData, this.userPost); // update origin data
			opt.onSet && opt.onSet(originData);
		}
	}

	function onPageBeforeShow() 
	{
		if (pageItf.formMode == FormMode.forAdd) {
			mCommon.setFormData(jf, pageItf.formData); // clear data
		}
		else if (pageItf.formMode == FormMode.forSet) {
			showObject();
		}
		else if (pageItf.formMode == FormMode.forFind) {
			// TODO: 之前不是forFind则应清空
			mCommon.setFormData(jf); // clear data
		}
		showByFormMode(jpage, pageItf.formMode);
	}

	// refresh?=false
	function showObject(refresh)
	{
		var data = pageItf.formData;
		if (data == null || data.id == null) {
			console.log("!!! showObject: no obj or obj.id");
			return;
		}

		// 如果formData中只有id属性，则发起get查询；否则直接用此数据。
		var needGet = true;
		if (! refresh) {
			for (var prop in data) {
				if (prop == "id" || $.isFunction(data[prop]))
					continue;
				needGet = false;
				break;
			}
		}
		if (! needGet) {
			onGet(data);
		}
		else {
			var queryParam = {
				ac: obj_ + ".get",
				id: data.id
			};
			opt.onGetData && opt.onGetData(jf, queryParam);
			var ac = queryParam.ac;
			delete queryParam.ac;
			self.callSvr(ac, queryParam, onGet);
		}

		function onGet(data)
		{
			mCommon.setFormData(jf, data, {setOrigin: true});
			opt.onGet && opt.onGet(data);
		}
	}

	function delObject()
	{
		var data = pageItf.formData;
		if (data == null || data.id == null) {
			console.log("!!! delObject: no obj or obj.id");
			return;
		}
		var ac = obj_ + ".del";
		self.callSvr(ac, {id: data.id}, opt.onDel);
	}

	var itf = {
		refresh: function () {
			showObject(true);
		},
		del: delObject
	}
	return itf;
}

}
