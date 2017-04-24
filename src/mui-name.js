jdModule("jdcloud.mui.name", ns_jdcloud_mui_name);
function ns_jdcloud_mui_name()
{
var self = this;
var mCommon = jdModule("jdcloud.common");

window.MUI = jdModule("jdcloud.mui");
$.extend(MUI, mCommon);

$.each([
	"intSort",
	"numberSort",
// 	"enterWaiting",
// 	"leaveWaiting",
// 	"makeUrl",
	"callSvr",
	"callSvrSync",
	"app_alert",
// 	"makeLinkTo",
], function () {
	window[this] = MUI[this];
});

/*
// 为了兼容
$.each([
	"enterWaiting",
	"leaveWaiting",
	"makeUrl",
	"makeLinkTo",
	"initPageList",
	"initPageDetail",
], function () {
	window[this] = MUI[this];
});
window.initNavbarAndList = initPageList;
*/

}
