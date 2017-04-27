jdModule("jdcloud.mui", JdcloudMuiName);
function JdcloudMuiName()
{
var self = this;
var mCommon = jdModule("jdcloud.common");

window.MUI = self;
$.extend(MUI, mCommon);

$.each([
	"intSort",
	"numberSort",
	"callSvr",
	"callSvrSync",
	"app_alert",
], function () {
	window[this] = MUI[this];
});


}
