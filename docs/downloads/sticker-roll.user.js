// ==UserScript==
// @name         Sticker Roll (abelrigm)
// @namespace    https://github.com/rigoabell/abelrigm_repository
// @version      1.2.0
// @updateURL    https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/sticker-roll.user.js
// @downloadURL  https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/sticker-roll.user.js
// @description  Print a side roll of stickers from a list. Each sticker has a 2D barcode above the value. Click through two colors.
// @author       abelrigm
// @match        http://*/*
// @match        https://*/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

/*
  A sticker button at the top center opens the panel. Paste a list and press Print.
  A roll of stickers sits on the left or the right. A 2D barcode is on top, the value underneath.
  Click a sticker: first color, second color, then white again.
  Colors and paint mode are set in the panel. Drag the handle at the bottom of the roll to resize it.
  Name a list to save it, open it from History, or Export the values.
*/

/* qrcode-generator 1.4.4, MIT, Kazuhiko Arase. Inlined so the 2D barcode draws without a CDN. */
/**
 * Minified by jsDelivr using Terser v5.37.0.
 * Original file: /npm/qrcode-generator@1.4.4/qrcode.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
var qrcode=function(){var t=function(t,r){var e=t,n=g[r],o=null,i=0,a=null,u=[],f={},c=function(t,r){o=function(t){for(var r=new Array(t),e=0;e<t;e+=1){r[e]=new Array(t);for(var n=0;n<t;n+=1)r[e][n]=null}return r}(i=4*e+17),l(0,0),l(i-7,0),l(0,i-7),s(),h(),d(t,r),e>=7&&v(t),null==a&&(a=p(e,n,u)),w(a,r)},l=function(t,r){for(var e=-1;e<=7;e+=1)if(!(t+e<=-1||i<=t+e))for(var n=-1;n<=7;n+=1)r+n<=-1||i<=r+n||(o[t+e][r+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},h=function(){for(var t=8;t<i-8;t+=1)null==o[t][6]&&(o[t][6]=t%2==0);for(var r=8;r<i-8;r+=1)null==o[6][r]&&(o[6][r]=r%2==0)},s=function(){for(var t=B.getPatternPosition(e),r=0;r<t.length;r+=1)for(var n=0;n<t.length;n+=1){var i=t[r],a=t[n];if(null==o[i][a])for(var u=-2;u<=2;u+=1)for(var f=-2;f<=2;f+=1)o[i+u][a+f]=-2==u||2==u||-2==f||2==f||0==u&&0==f}},v=function(t){for(var r=B.getBCHTypeNumber(e),n=0;n<18;n+=1){var a=!t&&1==(r>>n&1);o[Math.floor(n/3)][n%3+i-8-3]=a}for(n=0;n<18;n+=1){a=!t&&1==(r>>n&1);o[n%3+i-8-3][Math.floor(n/3)]=a}},d=function(t,r){for(var e=n<<3|r,a=B.getBCHTypeInfo(e),u=0;u<15;u+=1){var f=!t&&1==(a>>u&1);u<6?o[u][8]=f:u<8?o[u+1][8]=f:o[i-15+u][8]=f}for(u=0;u<15;u+=1){f=!t&&1==(a>>u&1);u<8?o[8][i-u-1]=f:u<9?o[8][15-u-1+1]=f:o[8][15-u-1]=f}o[i-8][8]=!t},w=function(t,r){for(var e=-1,n=i-1,a=7,u=0,f=B.getMaskFunction(r),c=i-1;c>0;c-=2)for(6==c&&(c-=1);;){for(var g=0;g<2;g+=1)if(null==o[n][c-g]){var l=!1;u<t.length&&(l=1==(t[u]>>>a&1)),f(n,c-g)&&(l=!l),o[n][c-g]=l,-1==(a-=1)&&(u+=1,a=7)}if((n+=e)<0||i<=n){n-=e,e=-e;break}}},p=function(t,r,e){for(var n=A.getRSBlocks(t,r),o=b(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw"code length overflow. ("+o.getLengthInBits()+">"+8*u+")";for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(t,r){for(var e=0,n=0,o=0,i=new Array(r.length),a=new Array(r.length),u=0;u<r.length;u+=1){var f=r[u].dataCount,c=r[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&t.getBuffer()[g+e];e+=f;var l=B.getErrorCorrectPolynomial(c),h=k(i[u],l.getLength()-1).mod(l);for(a[u]=new Array(l.getLength()-1),g=0;g<a[u].length;g+=1){var s=g+h.getLength()-a[u].length;a[u][g]=s>=0?h.getAt(s):0}}var v=0;for(g=0;g<r.length;g+=1)v+=r[g].totalCount;var d=new Array(v),w=0;for(g=0;g<n;g+=1)for(u=0;u<r.length;u+=1)g<i[u].length&&(d[w]=i[u][g],w+=1);for(g=0;g<o;g+=1)for(u=0;u<r.length;u+=1)g<a[u].length&&(d[w]=a[u][g],w+=1);return d}(o,n)};f.addData=function(t,r){var e=null;switch(r=r||"Byte"){case"Numeric":e=M(t);break;case"Alphanumeric":e=x(t);break;case"Byte":e=m(t);break;case"Kanji":e=L(t);break;default:throw"mode:"+r}u.push(e),a=null},f.isDark=function(t,r){if(t<0||i<=t||r<0||i<=r)throw t+","+r;return o[t][r]},f.getModuleCount=function(){return i},f.make=function(){if(e<1){for(var t=1;t<40;t++){for(var r=A.getRSBlocks(t,n),o=b(),i=0;i<u.length;i++){var a=u[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var g=0;for(i=0;i<r.length;i++)g+=r[i].dataCount;if(o.getLengthInBits()<=8*g)break}e=t}c(!1,function(){for(var t=0,r=0,e=0;e<8;e+=1){c(!0,e);var n=B.getLostPoint(f);(0==e||t>n)&&(t=n,r=e)}return r}())},f.createTableTag=function(t,r){t=t||2;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+(r=void 0===r?4*t:r)+"px;",e+='">',e+="<tbody>";for(var n=0;n<f.getModuleCount();n+=1){e+="<tr>";for(var o=0;o<f.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+t+"px;",e+=" height: "+t+"px;",e+=" background-color: ",e+=f.isDark(n,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>"},f.createSvgTag=function(t,r,e,n){var o={};"object"==typeof arguments[0]&&(t=(o=arguments[0]).cellSize,r=o.margin,e=o.alt,n=o.title),t=t||2,r=void 0===r?4*t:r,(e="string"==typeof e?{text:e}:e||{}).text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,(n="string"==typeof n?{text:n}:n||{}).text=n.text||null,n.id=n.text?n.id||"qrcode-title":null;var i,a,u,c,g=f.getModuleCount()*t+2*r,l="";for(c="l"+t+",0 0,"+t+" -"+t+",0 0,-"+t+"z ",l+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',l+=o.scalable?"":' width="'+g+'px" height="'+g+'px"',l+=' viewBox="0 0 '+g+" "+g+'" ',l+=' preserveAspectRatio="xMinYMin meet"',l+=n.text||e.text?' role="img" aria-labelledby="'+y([n.id,e.id].join(" ").trim())+'"':"",l+=">",l+=n.text?'<title id="'+y(n.id)+'">'+y(n.text)+"</title>":"",l+=e.text?'<description id="'+y(e.id)+'">'+y(e.text)+"</description>":"",l+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',l+='<path d="',a=0;a<f.getModuleCount();a+=1)for(u=a*t+r,i=0;i<f.getModuleCount();i+=1)f.isDark(a,i)&&(l+="M"+(i*t+r)+","+u+c);return l+='" stroke="transparent" fill="black"/>',l+="</svg>"},f.createDataURL=function(t,r){t=t||2,r=void 0===r?4*t:r;var e=f.getModuleCount()*t+2*r,n=r,o=e-r;return I(e,e,(function(r,e){if(n<=r&&r<o&&n<=e&&e<o){var i=Math.floor((r-n)/t),a=Math.floor((e-n)/t);return f.isDark(a,i)?0:1}return 1}))},f.createImgTag=function(t,r,e){t=t||2,r=void 0===r?4*t:r;var n=f.getModuleCount()*t+2*r,o="";return o+="<img",o+=' src="',o+=f.createDataURL(t,r),o+='"',o+=' width="',o+=n,o+='"',o+=' height="',o+=n,o+='"',e&&(o+=' alt="',o+=y(e),o+='"'),o+="/>"};var y=function(t){for(var r="",e=0;e<t.length;e+=1){var n=t.charAt(e);switch(n){case"<":r+="&lt;";break;case">":r+="&gt;";break;case"&":r+="&amp;";break;case'"':r+="&quot;";break;default:r+=n}}return r};return f.createASCII=function(t,r){if((t=t||1)<2)return function(t){t=void 0===t?2:t;var r,e,n,o,i,a=1*f.getModuleCount()+2*t,u=t,c=a-t,g={"██":"█","█ ":"▀"," █":"▄","  ":" "},l={"██":"▀","█ ":"▀"," █":" ","  ":" "},h="";for(r=0;r<a;r+=2){for(n=Math.floor((r-u)/1),o=Math.floor((r+1-u)/1),e=0;e<a;e+=1)i="█",u<=e&&e<c&&u<=r&&r<c&&f.isDark(n,Math.floor((e-u)/1))&&(i=" "),u<=e&&e<c&&u<=r+1&&r+1<c&&f.isDark(o,Math.floor((e-u)/1))?i+=" ":i+="█",h+=t<1&&r+1>=c?l[i]:g[i];h+="\n"}return a%2&&t>0?h.substring(0,h.length-a-1)+Array(a+1).join("▀"):h.substring(0,h.length-1)}(r);t-=1,r=void 0===r?2*t:r;var e,n,o,i,a=f.getModuleCount()*t+2*r,u=r,c=a-r,g=Array(t+1).join("██"),l=Array(t+1).join("  "),h="",s="";for(e=0;e<a;e+=1){for(o=Math.floor((e-u)/t),s="",n=0;n<a;n+=1)i=1,u<=n&&n<c&&u<=e&&e<c&&f.isDark(o,Math.floor((n-u)/t))&&(i=0),s+=i?g:l;for(o=0;o<t;o+=1)h+=s+"\n"}return h.substring(0,h.length-1)},f.renderTo2dContext=function(t,r){r=r||2;for(var e=f.getModuleCount(),n=0;n<e;n++)for(var o=0;o<e;o++)t.fillStyle=f.isDark(n,o)?"black":"white",t.fillRect(n*r,o*r,r,r)},f};t.stringToBytes=(t.stringToBytesFuncs={default:function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);r.push(255&n)}return r}}).default,t.createStringToBytes=function(t,r){var e=function(){for(var e=S(t),n=function(){var t=e.read();if(-1==t)throw"eof";return t},o=0,i={};;){var a=e.read();if(-1==a)break;var u=n(),f=n()<<8|n();i[String.fromCharCode(a<<8|u)]=f,o+=1}if(o!=r)throw o+" != "+r;return i}(),n="?".charCodeAt(0);return function(t){for(var r=[],o=0;o<t.length;o+=1){var i=t.charCodeAt(o);if(i<128)r.push(i);else{var a=e[t.charAt(o)];"number"==typeof a?(255&a)==a?r.push(a):(r.push(a>>>8),r.push(255&a)):r.push(n)}}return r}};var r,e,n,o,i,a=1,u=2,f=4,c=8,g={L:1,M:0,Q:3,H:2},l=0,h=1,s=2,v=3,d=4,w=5,p=6,y=7,B=(r=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],e=1335,n=7973,i=function(t){for(var r=0;0!=t;)r+=1,t>>>=1;return r},(o={}).getBCHTypeInfo=function(t){for(var r=t<<10;i(r)-i(e)>=0;)r^=e<<i(r)-i(e);return 21522^(t<<10|r)},o.getBCHTypeNumber=function(t){for(var r=t<<12;i(r)-i(n)>=0;)r^=n<<i(r)-i(n);return t<<12|r},o.getPatternPosition=function(t){return r[t-1]},o.getMaskFunction=function(t){switch(t){case l:return function(t,r){return(t+r)%2==0};case h:return function(t,r){return t%2==0};case s:return function(t,r){return r%3==0};case v:return function(t,r){return(t+r)%3==0};case d:return function(t,r){return(Math.floor(t/2)+Math.floor(r/3))%2==0};case w:return function(t,r){return t*r%2+t*r%3==0};case p:return function(t,r){return(t*r%2+t*r%3)%2==0};case y:return function(t,r){return(t*r%3+(t+r)%2)%2==0};default:throw"bad maskPattern:"+t}},o.getErrorCorrectPolynomial=function(t){for(var r=k([1],0),e=0;e<t;e+=1)r=r.multiply(k([1,C.gexp(e)],0));return r},o.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case a:return 10;case u:return 9;case f:case c:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case a:return 12;case u:return 11;case f:return 16;case c:return 10;default:throw"mode:"+t}else{if(!(r<41))throw"type:"+r;switch(t){case a:return 14;case u:return 13;case f:return 16;case c:return 12;default:throw"mode:"+t}}},o.getLostPoint=function(t){for(var r=t.getModuleCount(),e=0,n=0;n<r;n+=1)for(var o=0;o<r;o+=1){for(var i=0,a=t.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||r<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||r<=o+f||0==u&&0==f||a==t.isDark(n+u,o+f)&&(i+=1);i>5&&(e+=3+i-5)}for(n=0;n<r-1;n+=1)for(o=0;o<r-1;o+=1){var c=0;t.isDark(n,o)&&(c+=1),t.isDark(n+1,o)&&(c+=1),t.isDark(n,o+1)&&(c+=1),t.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<r;n+=1)for(o=0;o<r-6;o+=1)t.isDark(n,o)&&!t.isDark(n,o+1)&&t.isDark(n,o+2)&&t.isDark(n,o+3)&&t.isDark(n,o+4)&&!t.isDark(n,o+5)&&t.isDark(n,o+6)&&(e+=40);for(o=0;o<r;o+=1)for(n=0;n<r-6;n+=1)t.isDark(n,o)&&!t.isDark(n+1,o)&&t.isDark(n+2,o)&&t.isDark(n+3,o)&&t.isDark(n+4,o)&&!t.isDark(n+5,o)&&t.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<r;o+=1)for(n=0;n<r;n+=1)t.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/r/r-50)/5*10},o),C=function(){for(var t=new Array(256),r=new Array(256),e=0;e<8;e+=1)t[e]=1<<e;for(e=8;e<256;e+=1)t[e]=t[e-4]^t[e-5]^t[e-6]^t[e-8];for(e=0;e<255;e+=1)r[t[e]]=e;var n={glog:function(t){if(t<1)throw"glog("+t+")";return r[t]},gexp:function(r){for(;r<0;)r+=255;for(;r>=256;)r-=255;return t[r]}};return n}();function k(t,r){if(void 0===t.length)throw t.length+"/"+r;var e=function(){for(var e=0;e<t.length&&0==t[e];)e+=1;for(var n=new Array(t.length-e+r),o=0;o<t.length-e;o+=1)n[o]=t[o+e];return n}(),n={getAt:function(t){return e[t]},getLength:function(){return e.length},multiply:function(t){for(var r=new Array(n.getLength()+t.getLength()-1),e=0;e<n.getLength();e+=1)for(var o=0;o<t.getLength();o+=1)r[e+o]^=C.gexp(C.glog(n.getAt(e))+C.glog(t.getAt(o)));return k(r,0)},mod:function(t){if(n.getLength()-t.getLength()<0)return n;for(var r=C.glog(n.getAt(0))-C.glog(t.getAt(0)),e=new Array(n.getLength()),o=0;o<n.getLength();o+=1)e[o]=n.getAt(o);for(o=0;o<t.getLength();o+=1)e[o]^=C.gexp(C.glog(t.getAt(o))+r);return k(e,0).mod(t)}};return n}var A=function(){var t=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],r=function(t,r){var e={};return e.totalCount=t,e.dataCount=r,e},e={};return e.getRSBlocks=function(e,n){var o=function(r,e){switch(e){case g.L:return t[4*(r-1)+0];case g.M:return t[4*(r-1)+1];case g.Q:return t[4*(r-1)+2];case g.H:return t[4*(r-1)+3];default:return}}(e,n);if(void 0===o)throw"bad rs block @ typeNumber:"+e+"/errorCorrectionLevel:"+n;for(var i=o.length/3,a=[],u=0;u<i;u+=1)for(var f=o[3*u+0],c=o[3*u+1],l=o[3*u+2],h=0;h<f;h+=1)a.push(r(c,l));return a},e}(),b=function(){var t=[],r=0,e={getBuffer:function(){return t},getAt:function(r){var e=Math.floor(r/8);return 1==(t[e]>>>7-r%8&1)},put:function(t,r){for(var n=0;n<r;n+=1)e.putBit(1==(t>>>r-n-1&1))},getLengthInBits:function(){return r},putBit:function(e){var n=Math.floor(r/8);t.length<=n&&t.push(0),e&&(t[n]|=128>>>r%8),r+=1}};return e},M=function(t){var r=a,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+2<r.length;)t.put(o(r.substring(n,n+3)),10),n+=3;n<r.length&&(r.length-n==1?t.put(o(r.substring(n,n+1)),4):r.length-n==2&&t.put(o(r.substring(n,n+2)),7))}},o=function(t){for(var r=0,e=0;e<t.length;e+=1)r=10*r+i(t.charAt(e));return r},i=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);throw"illegal char :"+t};return n},x=function(t){var r=u,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+1<r.length;)t.put(45*o(r.charAt(n))+o(r.charAt(n+1)),11),n+=2;n<r.length&&t.put(o(r.charAt(n)),6)}},o=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);if("A"<=t&&t<="Z")return t.charCodeAt(0)-"A".charCodeAt(0)+10;switch(t){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+t}};return n},m=function(r){var e=f,n=t.stringToBytes(r),o={getMode:function(){return e},getLength:function(t){return n.length},write:function(t){for(var r=0;r<n.length;r+=1)t.put(n[r],8)}};return o},L=function(r){var e=c,n=t.stringToBytesFuncs.SJIS;if(!n)throw"sjis not supported.";!function(){var t=n("友");if(2!=t.length||38726!=(t[0]<<8|t[1]))throw"sjis not supported."}();var o=n(r),i={getMode:function(){return e},getLength:function(t){return~~(o.length/2)},write:function(t){for(var r=o,e=0;e+1<r.length;){var n=(255&r[e])<<8|255&r[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw"illegal char at "+(e+1)+"/"+n;n-=49472}n=192*(n>>>8&255)+(255&n),t.put(n,13),e+=2}if(e<r.length)throw"illegal char at "+(e+1)}};return i},D=function(){var t=[],r={writeByte:function(r){t.push(255&r)},writeShort:function(t){r.writeByte(t),r.writeByte(t>>>8)},writeBytes:function(t,e,n){e=e||0,n=n||t.length;for(var o=0;o<n;o+=1)r.writeByte(t[o+e])},writeString:function(t){for(var e=0;e<t.length;e+=1)r.writeByte(t.charCodeAt(e))},toByteArray:function(){return t},toString:function(){var r="";r+="[";for(var e=0;e<t.length;e+=1)e>0&&(r+=","),r+=t[e];return r+="]"}};return r},S=function(t){var r=t,e=0,n=0,o=0,i={read:function(){for(;o<8;){if(e>=r.length){if(0==o)return-1;throw"unexpected end of file./"+o}var t=r.charAt(e);if(e+=1,"="==t)return o=0,-1;t.match(/^\s$/)||(n=n<<6|a(t.charCodeAt(0)),o+=6)}var i=n>>>o-8&255;return o-=8,i}},a=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(43==t)return 62;if(47==t)return 63;throw"c:"+t};return i},I=function(t,r,e){for(var n=function(t,r){var e=t,n=r,o=new Array(t*r),i={setPixel:function(t,r,n){o[r*e+t]=n},write:function(t){t.writeString("GIF87a"),t.writeShort(e),t.writeShort(n),t.writeByte(128),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(255),t.writeByte(255),t.writeByte(255),t.writeString(","),t.writeShort(0),t.writeShort(0),t.writeShort(e),t.writeShort(n),t.writeByte(0);var r=a(2);t.writeByte(2);for(var o=0;r.length-o>255;)t.writeByte(255),t.writeBytes(r,o,255),o+=255;t.writeByte(r.length-o),t.writeBytes(r,o,r.length-o),t.writeByte(0),t.writeString(";")}},a=function(t){for(var r=1<<t,e=1+(1<<t),n=t+1,i=u(),a=0;a<r;a+=1)i.add(String.fromCharCode(a));i.add(String.fromCharCode(r)),i.add(String.fromCharCode(e));var f,c,g,l=D(),h=(f=l,c=0,g=0,{write:function(t,r){if(t>>>r!=0)throw"length over";for(;c+r>=8;)f.writeByte(255&(t<<c|g)),r-=8-c,t>>>=8-c,g=0,c=0;g|=t<<c,c+=r},flush:function(){c>0&&f.writeByte(g)}});h.write(r,n);var s=0,v=String.fromCharCode(o[s]);for(s+=1;s<o.length;){var d=String.fromCharCode(o[s]);s+=1,i.contains(v+d)?v+=d:(h.write(i.indexOf(v),n),i.size()<4095&&(i.size()==1<<n&&(n+=1),i.add(v+d)),v=d)}return h.write(i.indexOf(v),n),h.write(e,n),h.flush(),l.toByteArray()},u=function(){var t={},r=0,e={add:function(n){if(e.contains(n))throw"dup key:"+n;t[n]=r,r+=1},size:function(){return r},indexOf:function(r){return t[r]},contains:function(r){return void 0!==t[r]}};return e};return i}(t,r),o=0;o<r;o+=1)for(var i=0;i<t;i+=1)n.setPixel(i,o,e(i,o));var a=D();n.write(a);for(var u=function(){var t=0,r=0,e=0,n="",o={},i=function(t){n+=String.fromCharCode(a(63&t))},a=function(t){if(t<0);else{if(t<26)return 65+t;if(t<52)return t-26+97;if(t<62)return t-52+48;if(62==t)return 43;if(63==t)return 47}throw"n:"+t};return o.writeByte=function(n){for(t=t<<8|255&n,r+=8,e+=1;r>=6;)i(t>>>r-6),r-=6},o.flush=function(){if(r>0&&(i(t<<6-r),t=0,r=0),e%3!=0)for(var o=3-e%3,a=0;a<o;a+=1)n+="="},o.toString=function(){return n},o}(),f=a.toByteArray(),c=0;c<f.length;c+=1)u.writeByte(f[c]);return u.flush(),"data:image/gif;base64,"+u};return t}();qrcode.stringToBytesFuncs["UTF-8"]=function(t){return function(t){for(var r=[],e=0;e<t.length;e++){var n=t.charCodeAt(e);n<128?r.push(n):n<2048?r.push(192|n>>6,128|63&n):n<55296||n>=57344?r.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&t.charCodeAt(e)),r.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return r}(t)},function(t){"function"==typeof define&&define.amd?define([],t):"object"==typeof exports&&(module.exports=t())}((function(){return qrcode}));

(function () {
  'use strict';

  const VERSION = '1.2.0';
  const STORAGE_KEY = 'abelrigm.stickerRoll.v1';
  const MAX_STICKERS = 500;
  const MAX_LISTS = 30;
  const MIN_SCALE = 0.6;
  const MAX_SCALE = 2.2;
  const BASE_ROLL = 248;
  const DEFAULT_COLOR_1 = '#f6c945';
  const DEFAULT_COLOR_2 = '#8ec5ff';

  function clampScale(value) {
    const number = Number(value);
    if (!isFinite(number)) return 1;
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, number));
    return Math.round(clamped * 100) / 100;
  }

  function normalizeHex(value, fallback) {
    const text = String(value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(text)) return text.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(text)) {
      return ('#' + text.slice(1).split('').map((part) => part + part).join('')).toLowerCase();
    }
    return fallback;
  }

  function isDark(value) {
    const hex = normalizeHex(value, '#ffffff');
    const channels = [0, 2, 4].map((offset) => {
      const unit = parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255;
      return unit <= 0.03928 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
    });
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return luminance < 0.42;
  }

  function parseList(text) {
    const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!raw) return [];
    const lines = raw.split('\n');
    const pieces = lines.length > 1 ? lines : raw.split(/[,;\t]/);
    const values = [];
    pieces.forEach((piece) => {
      const cells = lines.length > 1 && piece.indexOf('\t') !== -1 ? piece.split('\t') : [piece];
      cells.forEach((cell) => {
        const value = String(cell || '').trim();
        if (value) values.push(value);
      });
    });
    return values;
  }

  function alignMarks(values, marks) {
    const next = [];
    const source = Array.isArray(marks) ? marks : [];
    for (let i = 0; i < values.length; i += 1) {
      const mark = Number(source[i]);
      next.push(mark === 1 || mark === 2 ? mark : 0);
    }
    return next;
  }

  function sameValues(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }

  function applyClick(mark, mode) {
    const current = mark === 1 || mark === 2 ? mark : 0;
    if (mode === 0 || mode === 1 || mode === 2) return mode;
    return (current + 1) % 3;
  }

  function stickerTextColor(mark, color1, color2) {
    if (mark !== 1 && mark !== 2) return '#1a1a1a';
    return isDark(mark === 1 ? color1 : color2) ? '#ffffff' : '#1a1a1a';
  }

  function stickerFill(mark, color1, color2) {
    if (mark === 1) return color1;
    if (mark === 2) return color2;
    return '#ffffff';
  }

  function dockSide(rollSide) {
    return rollSide === 'right' ? 'left' : 'right';
  }

  function sanitizeMode(mode) {
    if (mode === 0 || mode === 1 || mode === 2) return mode;
    if (mode === '0' || mode === '1' || mode === '2') return Number(mode);
    return 'cycle';
  }

  function sanitizeLists(lists) {
    if (!Array.isArray(lists)) return [];
    const saved = [];
    lists.forEach((list) => {
      if (!list || typeof list !== 'object') return;
      const values = Array.isArray(list.values)
        ? list.values.map((value) => String(value).trim()).filter(Boolean).slice(0, MAX_STICKERS)
        : [];
      const name = String(list.name || '').trim().slice(0, 80);
      if (!name || !values.length) return;
      saved.push({
        id: String(list.id || name).slice(0, 48),
        name: name,
        values: values,
        marks: alignMarks(values, list.marks),
        savedAt: Number(list.savedAt) || 0,
      });
    });
    return saved.slice(0, MAX_LISTS);
  }

  function defaultState() {
    return {
      side: 'left',
      color1: DEFAULT_COLOR_1,
      color2: DEFAULT_COLOR_2,
      mode: 'cycle',
      name: '',
      draft: '',
      values: [],
      marks: [],
      rollVisible: false,
      panelOpen: false,
      scale: 1,
      hidden: false,
      lists: [],
    };
  }

  function sanitizeState(raw) {
    const next = defaultState();
    if (!raw || typeof raw !== 'object') return next;
    next.side = raw.side === 'right' ? 'right' : 'left';
    next.color1 = normalizeHex(raw.color1, DEFAULT_COLOR_1);
    next.color2 = normalizeHex(raw.color2, DEFAULT_COLOR_2);
    next.mode = sanitizeMode(raw.mode);
    next.name = String(raw.name || '').slice(0, 80);
    next.draft = String(raw.draft || '');
    next.values = Array.isArray(raw.values)
      ? raw.values.map((value) => String(value).trim()).filter(Boolean).slice(0, MAX_STICKERS)
      : [];
    next.marks = alignMarks(next.values, raw.marks);
    next.rollVisible = raw.rollVisible === true && next.values.length > 0;
    next.panelOpen = raw.panelOpen === true;
    next.scale = clampScale(raw.scale);
    next.hidden = false;
    next.lists = sanitizeLists(raw.lists);
    return next;
  }

  function readStored(raw) {
    let parsed = raw;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (error) { parsed = null; }
    }
    return sanitizeState(parsed);
  }

  function printModel(previous, draft) {
    const parsed = parseList(draft);
    const values = parsed.slice(0, MAX_STICKERS);
    if (!values.length) return { error: 'Add a value' };
    const marks = alignMarks(values, sameValues(values, previous && previous.values) ? previous.marks : null);
    let status = String(values.length);
    if (parsed.length > values.length) status = values.length + ' of ' + parsed.length;
    return { values: values, marks: marks, status: status, rollVisible: true };
  }

  function fallbackName(values) {
    if (!values || !values.length) return '';
    const head = String(values[0]).slice(0, 24);
    if (values.length === 1) return head;
    return head + ' +' + (values.length - 1);
  }

  function upsertList(lists, entry) {
    const name = String(entry.name || '').trim().slice(0, 80);
    const values = (entry.values || []).slice(0, MAX_STICKERS);
    if (!name || !values.length) return { lists: sanitizeLists(lists), error: 'Nothing to save' };
    const existing = (Array.isArray(lists) ? lists : []).find((list) => {
      return String(list.name || '').trim().toLowerCase() === name.toLowerCase();
    });
    const saved = {
      id: existing ? existing.id : entry.id,
      name: name,
      values: values.slice(),
      marks: alignMarks(values, entry.marks),
      savedAt: entry.savedAt || Date.now(),
    };
    return {
      lists: [saved].concat((lists || []).filter((list) => list.id !== saved.id)).slice(0, MAX_LISTS),
      entry: saved,
    };
  }

  function exportBody(values) {
    const lines = Array.isArray(values) ? values : [];
    return lines.join('\n') + (lines.length ? '\n' : '');
  }

  function exportFileName(name) {
    const clean = String(name || 'sticker-roll')
      .trim()
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60);
    return (clean || 'sticker-roll') + '.txt';
  }

  function qrFactory() {
    if (typeof qrcode === 'function') return qrcode;
    if (typeof globalThis !== 'undefined' && typeof globalThis.qrcode === 'function') return globalThis.qrcode;
    return null;
  }

  function qrDataUrl(text) {
    const value = String(text || '');
    if (!value || value.length > 900) return '';
    const make = qrFactory();
    if (!make) return '';
    try {
      if (make.stringToBytesFuncs && make.stringToBytesFuncs['UTF-8']) {
        make.stringToBytes = make.stringToBytesFuncs['UTF-8'];
      }
      const qr = make(0, 'M');
      qr.addData(value);
      qr.make();
      return qr.createDataURL(4, 4);
    } catch (error) {
      return '';
    }
  }

  const api = {
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    MAX_STICKERS: MAX_STICKERS,
    MAX_LISTS: MAX_LISTS,
    MIN_SCALE: MIN_SCALE,
    MAX_SCALE: MAX_SCALE,
    BASE_ROLL: BASE_ROLL,
    clampScale: clampScale,
    DEFAULT_COLOR_1: DEFAULT_COLOR_1,
    DEFAULT_COLOR_2: DEFAULT_COLOR_2,
    normalizeHex: normalizeHex,
    isDark: isDark,
    parseList: parseList,
    alignMarks: alignMarks,
    sameValues: sameValues,
    applyClick: applyClick,
    stickerTextColor: stickerTextColor,
    stickerFill: stickerFill,
    dockSide: dockSide,
    sanitizeMode: sanitizeMode,
    sanitizeState: sanitizeState,
    readStored: readStored,
    printModel: printModel,
    fallbackName: fallbackName,
    upsertList: upsertList,
    exportBody: exportBody,
    exportFileName: exportFileName,
    qrDataUrl: qrDataUrl,
  };

  if (globalThis.__srExpose) globalThis.__sr = api;
  if (globalThis.__srNoBoot) return;

  const installed = Symbol.for('abelrigm.stickerRoll');
  if (globalThis[installed]) return;
  globalThis[installed] = true;

  function storageGet() {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(STORAGE_KEY, null);
    } catch (error) { /* use the page store */ }
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function storageSet(payload) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(STORAGE_KEY, payload);
        return;
      }
    } catch (error) { /* use the page store */ }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) { /* private mode */ }
  }

  const state = readStored(storageGet());
  const qrCache = new Map();
  let persistTimer = 0;
  let root = null;

  function payload() {
    return {
      side: state.side,
      color1: state.color1,
      color2: state.color2,
      mode: state.mode,
      name: state.name,
      draft: state.draft,
      values: state.values,
      marks: state.marks,
      rollVisible: state.rollVisible,
      panelOpen: state.panelOpen,
      scale: state.scale,
      hidden: state.hidden,
      lists: state.lists,
    };
  }

  function writeState() {
    persistTimer = 0;
    storageSet(payload());
  }

  function persist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(writeState, 160);
  }

  function flush() {
    if (persistTimer) clearTimeout(persistTimer);
    writeState();
  }

  function cachedQr(value) {
    if (qrCache.has(value)) return qrCache.get(value);
    const url = qrDataUrl(value);
    qrCache.set(value, url);
    return url;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function paintSticker(button, mark) {
    const color = stickerFill(mark, state.color1, state.color2);
    button.dataset.mark = String(mark);
    button.style.background = color;
    button.style.color = stickerTextColor(mark, state.color1, state.color2);
    const names = ['white', 'color 1', 'color 2'];
    button.setAttribute('aria-label', button.dataset.value + ', ' + (names[mark] || names[0]));
  }

  function syncShell() {
    if (!root) return;
    root.dataset.side = state.side;
    root.dataset.roll = state.rollVisible ? 'on' : 'off';
    root.dataset.panel = state.panelOpen ? 'open' : 'closed';
    root.hidden = state.hidden;
    root.style.setProperty('--sr-scale', String(state.scale || 1));
    const bar = root.querySelector('#sr-bar');
    const launch = root.querySelector('#sr-launch');
    if (bar) bar.hidden = !state.panelOpen;
    if (launch) launch.hidden = state.panelOpen;
    const sideButton = root.querySelector('[data-action="side"]');
    if (sideButton) {
      sideButton.textContent = state.side === 'right' ? 'Right' : 'Left';
      sideButton.title = state.side === 'right' ? 'Roll is on the right' : 'Roll is on the left';
    }
    root.querySelectorAll('input[data-color]').forEach((input) => {
      const next = input.dataset.color === '2' ? state.color2 : state.color1;
      if (input.value.toLowerCase() !== next) input.value = next;
    });
    root.querySelectorAll('[data-mode]').forEach((button) => {
      const on = String(state.mode) === button.dataset.mode;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (button.dataset.mode === '1') {
        button.style.background = state.color1;
        button.style.color = isDark(state.color1) ? '#ffffff' : '#1a1a1a';
      } else if (button.dataset.mode === '2') {
        button.style.background = state.color2;
        button.style.color = isDark(state.color2) ? '#ffffff' : '#1a1a1a';
      }
    });
    const roll = root.querySelector('#sr-roll');
    if (roll) roll.hidden = !state.rollVisible;
  }

  function repaintStickers() {
    if (!root) return;
    root.querySelectorAll('.sr-sticker').forEach((button) => {
      paintSticker(button, Number(button.dataset.mark) || 0);
    });
  }

  function renderRoll() {
    const roll = root.querySelector('#sr-stickers');
    roll.replaceChildren();
    state.values.forEach((value, index) => {
      const button = el('button', 'sr-sticker');
      button.type = 'button';
      button.setAttribute('role', 'listitem');
      button.dataset.index = String(index);
      button.dataset.value = value;
      button.title = value;
      const image = el('img', 'sr-code');
      image.alt = '2D barcode';
      image.draggable = false;
      const url = cachedQr(value);
      if (url) image.src = url;
      else image.hidden = true;
      const label = el('span', 'sr-value', value);
      if (value.length > 42) label.classList.add('is-long');
      else if (value.length > 24) label.classList.add('is-medium');
      button.append(image, label);
      paintSticker(button, state.marks[index] || 0);
      roll.append(button);
    });
    syncShell();
  }

  function fillHistory() {
    const select = root.querySelector('#sr-history');
    const selected = select.value;
    select.replaceChildren();
    const placeholder = el('option', '', 'History');
    placeholder.value = '';
    select.append(placeholder);
    state.lists.forEach((list) => {
      const option = el('option', '', list.name);
      option.value = list.id;
      select.append(option);
    });
    if ([].some.call(select.options, (option) => option.value === selected)) select.value = selected;
  }

  function setStatus(text) {
    const status = root.querySelector('#sr-status');
    if (status) status.textContent = text || '';
  }

  function setColor(slot, value) {
    const fallback = slot === '2' ? DEFAULT_COLOR_2 : DEFAULT_COLOR_1;
    const hex = normalizeHex(value, fallback);
    if (slot === '2') state.color2 = hex;
    else state.color1 = hex;
    syncShell();
    repaintStickers();
    persist();
  }

  function setMode(mode) {
    const next = sanitizeMode(mode);
    state.mode = String(state.mode) === String(next) && next !== 'cycle' ? 'cycle' : next;
    syncShell();
    persist();
  }

  function setSide(side) {
    state.side = side === 'right' ? 'right' : 'left';
    syncShell();
    persist();
  }

  function setPanel(open) {
    state.panelOpen = open === true;
    state.hidden = false;
    if (!state.panelOpen && root) {
      const box = root.querySelector('#sr-list');
      if (box) box.blur();
    }
    if (!root) mount();
    else syncShell();
    persist();
  }

  function showUi() {
    setPanel(true);
  }

  function hideUi() {
    setPanel(false);
  }

  function onPrint() {
    const box = root.querySelector('#sr-list');
    const printed = printModel(state, box.value);
    if (printed.error) {
      setStatus(printed.error);
      box.focus();
      return;
    }
    state.values = printed.values;
    state.marks = printed.marks;
    state.draft = box.value;
    state.rollVisible = true;
    state.hidden = false;
    state.panelOpen = true;
    renderRoll();
    setStatus(printed.status);
    persist();
  }

  function onSave() {
    if (!state.values.length) {
      const printed = printModel(state, root.querySelector('#sr-list').value);
      if (printed.error) {
        setStatus('Print a list first');
        return;
      }
      state.values = printed.values;
      state.marks = printed.marks;
      state.draft = root.querySelector('#sr-list').value;
      state.rollVisible = true;
      renderRoll();
    }
    const nameInput = root.querySelector('#sr-name');
    const name = nameInput.value.trim() || fallbackName(state.values);
    const saved = upsertList(state.lists, {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      values: state.values,
      marks: state.marks,
      savedAt: Date.now(),
    });
    if (saved.error) {
      setStatus(saved.error);
      return;
    }
    state.lists = saved.lists;
    state.name = saved.entry.name;
    nameInput.value = saved.entry.name;
    fillHistory();
    root.querySelector('#sr-history').value = saved.entry.id;
    setStatus('Saved');
    persist();
  }

  function onLoad(id) {
    const entry = state.lists.find((list) => list.id === id);
    if (!entry) return;
    state.name = entry.name;
    state.values = entry.values.slice();
    state.marks = entry.marks.slice();
    state.draft = entry.values.join('\n');
    state.rollVisible = true;
    root.querySelector('#sr-name').value = entry.name;
    root.querySelector('#sr-list').value = state.draft;
    renderRoll();
    setStatus(state.values.length + ' loaded');
    persist();
  }

  function onDelete() {
    const select = root.querySelector('#sr-history');
    if (!select.value) {
      setStatus('Pick a saved list');
      return;
    }
    state.lists = state.lists.filter((list) => list.id !== select.value);
    fillHistory();
    setStatus('Deleted');
    persist();
  }

  function onExport() {
    const box = root.querySelector('#sr-list');
    const values = state.values.length ? state.values : parseList(box.value);
    if (!values.length) {
      setStatus('Nothing to export');
      return;
    }
    const name = root.querySelector('#sr-name').value.trim() || fallbackName(values);
    const blob = new Blob([exportBody(values)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = el('a');
    link.href = url;
    link.download = exportFileName(name);
    document.documentElement.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus('Exported');
  }

  function onListInput() {
    state.draft = root.querySelector('#sr-list').value;
    persist();
  }

  function mount() {
    if (root) root.remove();
    root = el('div');
    root.id = 'sr-root';

    const style = el('style');
    style.textContent = [
      '#sr-root{position:fixed;inset:0;z-index:2147483647;pointer-events:none;color-scheme:light;',
      'font-family:"Segoe UI",system-ui,-apple-system,sans-serif;color:#2a2a2a;}',
      '#sr-root[hidden]{display:none !important;}',
      '#sr-root *,#sr-root *::before,#sr-root *::after{box-sizing:border-box;}',
      '#sr-launch,#sr-bar,#sr-roll,#sr-grip{pointer-events:auto;}',
      '#sr-bar{position:absolute;top:8px;left:0;right:0;width:max-content;max-width:calc(100% - 16px);',
      'margin:0 auto;transform:none;',
      'display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:center;',
      'padding:8px 10px;',
      'background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:16px;',
      'box-shadow:0 1px 1px rgba(0,0,0,.05),0 7px 14px rgba(0,0,0,.08);',
      'font-size:11px;line-height:1.2;}',
      '#sr-root[data-roll="on"][data-side="left"] #sr-bar{left:calc(248px * var(--sr-scale, 1));right:8px;}',
      '#sr-root[data-roll="on"][data-side="right"] #sr-bar{left:8px;right:calc(248px * var(--sr-scale, 1));}',
      '#sr-launch{position:absolute !important;top:12px !important;left:50% !important;transform:translateX(-50%) !important;',
      'z-index:4 !important;width:24px !important;height:24px !important;margin:0 !important;padding:0 !important;',
      'border-radius:50% !important;border:1px solid rgba(0,0,0,.08) !important;background:#fff !important;',
      'box-shadow:0 1px 1px rgba(0,0,0,.05),0 4px 10px rgba(0,0,0,.12) !important;cursor:pointer !important;',
      'opacity:1 !important;visibility:visible !important;font-size:13px !important;line-height:1 !important;',
      'display:flex !important;align-items:center !important;justify-content:center !important;}',
      '#sr-launch:hover{background:#fff !important;}',
      '#sr-bar{z-index:3;}',
      '#sr-roll{z-index:1;}',
      '#sr-bar:has(#sr-list:focus){align-items:flex-start;border-radius:16px;background:#fff;}',
      '#sr-list{width:148px;height:22px;margin:0;padding:3px 8px;resize:none;overflow:hidden;',
      'border:1px solid transparent;border-radius:999px;background:rgba(255,255,255,.55);',
      'color:#333;font:inherit;outline:none;}',
      '#sr-list::placeholder{color:#9a9a9a;}',
      '#sr-list:focus{width:220px;height:92px;overflow:auto;border-radius:8px;',
      'border-color:rgba(0,0,0,.14);background:#fff;}',
      '#sr-name{width:76px;height:22px;margin:0;padding:2px 7px;border:1px solid transparent;',
      'border-radius:999px;background:rgba(255,255,255,.55);color:#333;font:inherit;outline:none;}',
      '#sr-name:focus{border-color:rgba(0,0,0,.14);background:#fff;}',
      '#sr-history{width:92px;height:22px;margin:0;padding:0 4px;border:1px solid transparent;',
      'border-radius:999px;background:rgba(255,255,255,.7);color:#444;font:inherit;outline:none;}',
      '#sr-bar button{margin:0;border:0;background:transparent;color:#444;font:inherit;font-weight:600;',
      'border-radius:999px;padding:3px 7px;cursor:pointer;line-height:1.2;}',
      '#sr-print{background:#2c2c2c !important;color:#fff !important;padding:4px 10px !important;}',
      '#sr-bar button:hover{background:rgba(0,0,0,.06);}',
      '#sr-print:hover{background:#111 !important;}',
      '#sr-hide{width:22px !important;height:22px !important;padding:0 !important;border-radius:50% !important;',
      'background:#d01212 !important;color:#fff !important;font-size:14px !important;font-weight:700 !important;}',
      '#sr-hide:hover{background:#a30e0e !important;}',
      '#sr-status{min-width:0;max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#888;}',
      '#sr-key{color:#888;font-size:10px;font-weight:700;}',
      '#sr-bar .sr-mode{border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:8px;padding:3px 7px;}',
      '#sr-bar .sr-mode[aria-pressed="true"]{box-shadow:inset 0 0 0 1.5px #222;}',
      '#sr-bar input[type="color"]{-webkit-appearance:none;appearance:none;',
      'width:16px;height:16px;padding:0;border:1px solid rgba(0,0,0,.25);border-radius:50%;',
      'background:transparent;cursor:pointer;}',
      '#sr-bar input[type="color"]::-webkit-color-swatch-wrapper{padding:0;}',
      '#sr-bar input[type="color"]::-webkit-color-swatch{border:0;border-radius:50%;}',
      '#sr-roll{position:absolute;top:0;bottom:0;width:calc(248px * var(--sr-scale, 1));',
      'display:flex;flex-direction:column;overflow:hidden;background:#f4f3f1;}',
      '#sr-stickers{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;',
      'padding:10px 0 8px;scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.28) transparent;}',
      '#sr-root[data-side="left"] #sr-roll{left:0;box-shadow:12px 0 28px rgba(0,0,0,.16);}',
      '#sr-root[data-side="right"] #sr-roll{right:0;box-shadow:-12px 0 28px rgba(0,0,0,.16);}',
      '#sr-stickers::-webkit-scrollbar{width:8px;}',
      '#sr-stickers::-webkit-scrollbar-thumb{background:rgba(0,0,0,.25);border-radius:8px;}',
      '#sr-grip{flex:none;height:28px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;',
      'touch-action:none;background:#f4f3f1;border-top:1px solid rgba(0,0,0,.08);}',
      '#sr-grip i{display:block;width:42px;max-width:46%;height:4px;border-radius:4px;background:rgba(0,0,0,.35);}',
      '.sr-sticker{all:unset;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;',
      'justify-content:flex-start;width:calc(100% - calc(28px * var(--sr-scale, 1)));',
      'min-height:calc(112px * var(--sr-scale, 1));margin:calc(4px * var(--sr-scale, 1)) calc(14px * var(--sr-scale, 1));',
      'padding:calc(8px * var(--sr-scale, 1)) calc(8px * var(--sr-scale, 1)) calc(7px * var(--sr-scale, 1));',
      'border-radius:calc(16px * var(--sr-scale, 1));background:#fff;cursor:pointer;position:relative;overflow:hidden;user-select:none;',
      'box-shadow:0 1px 1px rgba(0,0,0,.05),0 7px 14px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.85);',
      'border:1px solid rgba(0,0,0,.06);transition:background-color .12s ease,color .12s ease;}',
      '.sr-sticker::before{content:"";position:absolute;left:0;right:0;top:0;height:42%;',
      'background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0));pointer-events:none;}',
      '.sr-sticker:focus-visible{outline:2px solid #222;outline-offset:2px;}',
      '.sr-sticker:active{transform:scale(.985);}',
      '.sr-code{width:calc(78px * var(--sr-scale, 1));height:calc(78px * var(--sr-scale, 1));object-fit:contain;',
      'background:#fff;padding:calc(3px * var(--sr-scale, 1));border-radius:4px;',
      'position:relative;z-index:1;pointer-events:none;}',
      '.sr-value{position:relative;z-index:1;margin-top:calc(3px * var(--sr-scale, 1));max-width:100%;text-align:center;',
      'font-weight:600;font-size:calc(13px * var(--sr-scale, 1));line-height:1.15;letter-spacing:0;',
      'overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.sr-value.is-medium{font-size:calc(11px * var(--sr-scale, 1));}',
      '.sr-value.is-long{font-size:calc(10px * var(--sr-scale, 1));}',
      '#sr-launch[hidden],#sr-bar[hidden],#sr-roll[hidden]{display:none !important;}',
    ].join('');
    root.append(style);

    const bar = el('div');
    bar.id = 'sr-bar';
    const list = el('textarea');
    list.id = 'sr-list';
    list.placeholder = 'values';
    list.rows = 1;
    list.spellcheck = false;
    list.title = 'One value per line. Commas work on a single line. Ctrl+Enter prints.';
    list.value = state.draft || state.values.join('\n');
    list.setAttribute('aria-label', 'Sticker values');

    const print = el('button', '', 'Print');
    print.id = 'sr-print';
    print.type = 'button';
    print.dataset.action = 'print';
    print.title = 'Print the list as a sticker roll';

    const side = el('button', '', state.side === 'right' ? 'Right' : 'Left');
    side.type = 'button';
    side.dataset.action = 'side';
    side.title = 'Which side the roll sits on';

    const color1 = el('input');
    color1.type = 'color';
    color1.dataset.color = '1';
    color1.value = state.color1;
    color1.title = 'First click color';
    color1.setAttribute('aria-label', 'First click color');

    const color2 = el('input');
    color2.type = 'color';
    color2.dataset.color = '2';
    color2.value = state.color2;
    color2.title = 'Second click color';
    color2.setAttribute('aria-label', 'Second click color');

    const name = el('input');
    name.id = 'sr-name';
    name.type = 'text';
    name.placeholder = 'name';
    name.value = state.name || '';
    name.maxLength = 80;
    name.setAttribute('aria-label', 'List name');
    name.autocomplete = 'off';

    const save = el('button', '', 'Save');
    save.type = 'button';
    save.dataset.action = 'save';
    save.title = 'Save this list under the name';

    const history = el('select');
    history.id = 'sr-history';
    history.title = 'Saved lists';
    history.setAttribute('aria-label', 'Saved lists');

    const exportButton = el('button', '', 'Export');
    exportButton.type = 'button';
    exportButton.dataset.action = 'export';
    exportButton.title = 'Download the values as a text file';

    const cycle = el('button', 'sr-mode', 'Cycle');
    cycle.type = 'button';
    cycle.dataset.mode = 'cycle';
    cycle.title = 'Clicks go to color 1, then color 2, then white';

    const paint1 = el('button', 'sr-mode', '1');
    paint1.type = 'button';
    paint1.dataset.mode = '1';
    paint1.title = 'Paint color 1';

    const paint2 = el('button', 'sr-mode', '2');
    paint2.type = 'button';
    paint2.dataset.mode = '2';
    paint2.title = 'Paint color 2';

    const paintWhite = el('button', 'sr-mode', 'White');
    paintWhite.type = 'button';
    paintWhite.dataset.mode = '0';
    paintWhite.title = 'Paint white';

    const del = el('button', '', 'Del');
    del.type = 'button';
    del.dataset.action = 'delete';
    del.title = 'Delete the selected saved list';

    const hide = el('button', '', '×');
    hide.id = 'sr-hide';
    hide.type = 'button';
    hide.dataset.action = 'hide';
    hide.title = 'Close the panel';
    hide.setAttribute('aria-label', 'Close the panel');

    const status = el('span', '', '');
    status.id = 'sr-status';
    status.setAttribute('aria-live', 'polite');

    bar.append(list, print, side, cycle, paint1, color1, paint2, color2, paintWhite, name, save, history, exportButton, del, hide, status);

    const launch = el('button', '', '🏷️');
    launch.id = 'sr-launch';
    launch.type = 'button';
    launch.dataset.action = 'open';
    launch.title = 'Open sticker roll';
    launch.setAttribute('aria-label', 'Open sticker roll');

    const roll = el('div');
    roll.id = 'sr-roll';
    const stickers = el('div');
    stickers.id = 'sr-stickers';
    stickers.setAttribute('role', 'list');
    stickers.setAttribute('aria-label', 'Sticker roll');
    const grip = el('div');
    grip.id = 'sr-grip';
    grip.tabIndex = 0;
    grip.title = 'Drag down to enlarge the roll, up to shrink it';
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'horizontal');
    grip.setAttribute('aria-label', 'Resize the roll');
    grip.append(el('i'));
    roll.append(stickers, grip);
    grip.addEventListener('pointerdown', (event) => {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      grip.setPointerCapture(event.pointerId);
      const startY = event.clientY;
      const startScale = state.scale;
      function move(ev) {
        state.scale = clampScale(startScale + (ev.clientY - startY) / 160);
        root.style.setProperty('--sr-scale', String(state.scale));
      }
      function end() {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', end);
        grip.removeEventListener('pointercancel', end);
        persist();
      }
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    });
    grip.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') state.scale = clampScale(state.scale + 0.08);
      else if (event.key === 'ArrowUp') state.scale = clampScale(state.scale - 0.08);
      else return;
      event.preventDefault();
      root.style.setProperty('--sr-scale', String(state.scale));
      persist();
    });

    root.append(launch, bar, roll);
    root.addEventListener('pointerdown', (event) => event.stopPropagation());
    root.addEventListener('mousedown', (event) => event.stopPropagation());
    root.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      const modeButton = event.target.closest('[data-mode]');
      if (action) {
        event.preventDefault();
        const kind = action.dataset.action;
        if (kind === 'print') onPrint();
        else if (kind === 'side') setSide(state.side === 'left' ? 'right' : 'left');
        else if (kind === 'save') onSave();
        else if (kind === 'export') onExport();
        else if (kind === 'delete') onDelete();
        else if (kind === 'open') setPanel(true);
        else if (kind === 'hide') setPanel(false);
      } else if (modeButton && bar.contains(modeButton)) {
        event.preventDefault();
        setMode(modeButton.dataset.mode);
      } else {
        const sticker = event.target.closest('.sr-sticker');
        if (sticker && roll.contains(sticker)) {
          event.preventDefault();
          const index = Number(sticker.dataset.index);
          const mark = applyClick(state.marks[index], state.mode);
          state.marks[index] = mark;
          paintSticker(sticker, mark);
          persist();
        }
      }
      event.stopPropagation();
    });

    list.addEventListener('input', onListInput);
    list.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onPrint();
      }
    });
    name.addEventListener('input', () => {
      state.name = name.value;
      persist();
    });
    name.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onSave();
      }
    });
    history.addEventListener('change', () => {
      if (history.value) onLoad(history.value);
    });
    root.querySelectorAll('input[type="color"]').forEach((input) => {
      input.addEventListener('input', () => setColor(input.dataset.color, input.value));
    });

    document.documentElement.appendChild(root);
    fillHistory();
    if (state.rollVisible) renderRoll();
    else syncShell();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Show sticker roll', showUi);
    GM_registerMenuCommand('Close sticker panel', hideUi);
    GM_registerMenuCommand('Move sticker roll', () => {
      showUi();
      setSide(state.side === 'left' ? 'right' : 'left');
    });
  }

  mount();
})();
