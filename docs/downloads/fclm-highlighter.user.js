// ==UserScript==
// @name         FCLM Highlighter
// @namespace    com.amazon.shocklp
// @version      2.1
// @description  Highlights user selected rows. Copy debug copies the page match, saved highlights, and row structure.
// @author       Phillip Shockley | shocklp
// @match        https://fclm-portal.amazon.com/*
// @grant        GM_info
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/fclm-highlighter.user.js
// @updateURL    https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/fclm-highlighter.user.js
// @icon         https://fclm-portal.amazon.com/resources/images/icon.jpg
// @require      https://axzile.corp.amazon.com/-/carthamus/download_script/wait-for-key-elements.user.js
// @run-at       document-end
// ==/UserScript==
/* global waitForKeyElements, GM_addStyle, GM_setClipboard, GM_registerMenuCommand */
(function() {
    'use strict';
    var SCRIPT_NAME = 'FCLM Highlighter';
    var SCRIPT_VERSION = '2.1';
    var DEBUG_BUTTON_ID = 'fclm-highlighter-copy-debug';
    var urlmatch = null;
    var FC = '';
    var highlights = [];
    var row = [];
    var pageBranch = '';
    var initStage = 'start';
    var bootError = null;

    function clip(value, max) {
        var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
        if (text.length <= max) return text;
        return text.slice(0, max) + '...';
    }

    function classNameOf(el) {
        if (!el) return '';
        if (typeof el.className === 'string') return el.className;
        if (el.className && el.className.baseVal != null) return String(el.className.baseVal);
        return '';
    }

    function errorInfo(err) {
        return {
            message: err && err.message ? String(err.message) : String(err),
            stack: err && err.stack ? String(err.stack).split('\n').slice(0, 8).join('\n') : ''
        };
    }

    function pageUrl() {
        try {
            if (typeof location !== 'undefined' && location && location.href) return String(location.href);
        } catch (err) { /* document.URL below */ }
        return String(document.URL || '');
    }

    function parseUrl(url) {
        var out = { href: url, pathname: '', search: '', params: {} };
        var match = /^https?:\/\/[^/]+([^?#]*)(\?[^#]*)?/.exec(url);
        if (!match) return out;
        out.pathname = match[1] || '';
        out.search = match[2] || '';
        var query = out.search.replace(/^\?/, '');
        if (!query) return out;
        var parts = query.split('&');
        for (var i = 0; i < parts.length; i++) {
            var bits = parts[i].split('=');
            var key = bits[0] || '';
            var value = bits.slice(1).join('=');
            try { key = decodeURIComponent(key); } catch (err) { /* keep raw key */ }
            try { value = decodeURIComponent(value.replace(/\+/g, ' ')); } catch (err2) { /* keep raw value */ }
            if (key) out.params[key] = value;
        }
        return out;
    }

    function pathTail(pathname) {
        var parts = String(pathname || '').split('/');
        for (var i = parts.length - 1; i >= 0; i--) {
            if (parts[i]) return parts[i];
        }
        return '';
    }

    function countSel(selector) {
        try { return document.querySelectorAll(selector).length; }
        catch (err) { return null; }
    }

    function describeCell(cell) {
        var box = null;
        try {
            box = cell && cell.querySelector ? cell.querySelector('input[type="checkbox"]') : null;
        } catch (err) { box = null; }
        return {
            tag: cell && cell.tagName ? cell.tagName : '',
            className: clip(classNameOf(cell), 100),
            text: clip(cell && (cell.innerText || cell.textContent) || '', 60),
            checkbox: box ? !!box.checked : false
        };
    }

    function describeRow(el, index) {
        var cells = [];
        var kids = el && el.children ? el.children : [];
        for (var i = 0; i < kids.length && cells.length < 16; i++) cells.push(describeCell(kids[i]));
        var box = null;
        try { box = el.querySelector('input[type="checkbox"]'); } catch (err) { box = null; }
        return {
            index: index,
            id: el && el.id ? el.id : '',
            className: clip(classNameOf(el), 120),
            cellCount: kids.length,
            checked: box ? !!box.checked : false,
            cells: cells
        };
    }

    function savedHighlightStores() {
        var out = {};
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (!key || key.indexOf('highlights_') !== 0) continue;
                var raw = localStorage.getItem(key);
                var parsed = null;
                var error = null;
                try { parsed = JSON.parse(raw); }
                catch (err) { error = err && err.message ? err.message : String(err); }
                out[key] = { raw: clip(raw, 500), parsed: parsed, error: error };
            }
        } catch (err) {
            out.readError = err && err.message ? err.message : String(err);
        }
        return out;
    }

    function idsWithClass(className) {
        var out = [];
        var nodes = [];
        try { nodes = document.querySelectorAll('.' + className); } catch (err) { return out; }
        for (var i = 0; i < nodes.length && out.length < 40; i++) out.push(nodes[i].id || '');
        return out;
    }

    function collectDebug() {
        var url = pageUrl();
        var parsed = parseUrl(url);
        var list = row && typeof row.length === 'number' ? row : [];
        var samples = [];
        var withoutId = 0;
        var seen = {};
        var duplicateIds = [];
        for (var i = 0; i < list.length; i++) {
            if (!list[i] || !list[i].id) withoutId++;
            else if (seen[list[i].id]) duplicateIds.push(list[i].id);
            else seen[list[i].id] = true;
            if (samples.length >= 12) continue;
            try { samples.push(describeRow(list[i], i)); }
            catch (err) { samples.push({ index: i, error: err && err.message ? err.message : String(err) }); }
        }
        var missing = [];
        var saved = Array.isArray(highlights) ? highlights.slice() : highlights;
        if (Array.isArray(highlights)) {
            for (var h = 0; h < highlights.length; h++) {
                var id = highlights[h];
                var found = false;
                try { found = !!(id && document.getElementById(id)); } catch (err) { found = false; }
                if (!found) missing.push(id);
            }
        }
        var exactRatios = [];
        var otherRatios = [];
        var exactCount = 0;
        var otherCount = 0;
        try {
            var cells = document.querySelectorAll('td, th');
            for (var c = 0; c < cells.length; c++) {
                var name = classNameOf(cells[c]);
                if (name === 'numeric ratioToPlan ratio' || name.indexOf('numeric ratioToPlan ratio ') === 0) {
                    exactCount++;
                    if (exactRatios.length < 8) exactRatios.push(describeCell(cells[c]));
                } else if (/(^|\s)ratio(\s|$)|ratioToPlan/.test(name)) {
                    otherCount++;
                    if (otherRatios.length < 8) otherRatios.push(describeCell(cells[c]));
                }
            }
        } catch (err) {
            otherRatios.push({ error: err && err.message ? err.message : String(err) });
        }
        var thead = null;
        var header = null;
        var visibility = null;
        try { thead = document.getElementsByTagName('thead')[0]; } catch (err) { thead = null; }
        try { header = document.getElementById('fcpn-header'); } catch (err2) { header = null; }
        try { visibility = document.getElementById('visibility'); } catch (err3) { visibility = null; }
        var headerLabels = [];
        if (thead && thead.children && thead.children.length) {
            var labelRow = thead.children[thead.children.length - 1];
            var labelCells = labelRow && labelRow.children ? labelRow.children : [];
            for (var t = 0; t < labelCells.length && headerLabels.length < 16; t++) {
                headerLabels.push(clip(labelCells[t].innerText || labelCells[t].textContent, 40));
            }
        }
        return {
            script: SCRIPT_NAME,
            version: SCRIPT_VERSION,
            generatedAt: new Date().toISOString(),
            initStage: initStage,
            bootError: bootError,
            page: {
                url: url,
                pathname: parsed.pathname,
                pathTail: pathTail(parsed.pathname),
                params: parsed.params,
                regexMatch: urlmatch ? { page: urlmatch[1], warehouse: urlmatch[2] } : null,
                branch: pageBranch,
                warehouse: FC
            },
            storage: savedHighlightStores(),
            highlights: {
                saved: saved,
                savedIsArray: Array.isArray(highlights),
                missingFromDom: missing,
                domHighlightIds: idsWithClass('highlight'),
                domCheckedIds: (function () {
                    var out = [];
                    for (var r = 0; r < list.length && out.length < 40; r++) {
                        var described = samples[r] && samples[r].index === r ? samples[r] : null;
                        var checked = described ? described.checked : false;
                        if (!described) {
                            try {
                                var box = list[r].querySelector('input[type="checkbox"]');
                                checked = !!(box && box.checked);
                            } catch (err) { checked = false; }
                        }
                        if (checked) out.push(list[r] && list[r].id ? list[r].id : '');
                    }
                    return out;
                })()
            },
            rows: {
                targeted: list.length,
                withoutId: withoutId,
                duplicateIds: duplicateIds,
                samples: samples
            },
            census: {
                lineItem: countSel('.lineItem'),
                emplAll: countSel('.empl-all'),
                emplAmzn: countSel('.empl-amzn'),
                totRow: countSel('.tot-row'),
                nodeRows: countSel('tr.lineItem, tr.line-item-total, tr.core-process-total, tr.main-process-total'),
                resultTable: countSel('.result-table'),
                thead: countSel('thead'),
                floatHeader: countSel('div.floatHeader'),
                highlight: countSel('.highlight'),
                hideMe: countSel('.hideMe'),
                over100: countSel('.over100'),
                under100: countSel('.under100')
            },
            ratios: {
                exactClassCount: exactCount,
                exactSamples: exactRatios,
                otherRatioCount: otherCount,
                otherRatioSamples: otherRatios
            },
            mount: {
                stickyHead: !!(thead && thead.classList && thead.classList.contains('stickyHead')),
                headerFound: !!header,
                headerPosition: header && header.style ? header.style.position || '' : '',
                visibilityToggle: !!visibility,
                visibilityChecked: !!(visibility && visibility.checked),
                resultTable: countSel('.result-table'),
                headerLabels: headerLabels
            }
        };
    }

    function copyText(text, done) {
        try {
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(text, 'text');
                done(null);
                return;
            }
        } catch (err) { /* fall through */ }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { done(null); }, function () { fallbackCopy(text, done); });
            return;
        }
        fallbackCopy(text, done);
    }

    function fallbackCopy(text, done) {
        var ta = null;
        try {
            ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            (document.body || document.documentElement).appendChild(ta);
            ta.select();
            if (document.execCommand('copy')) done(null);
            else done(new Error('copy failed'));
        } catch (err) {
            done(err);
        } finally {
            if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
        }
    }

    function copyDebug() {
        var btn = null;
        try { btn = document.getElementById(DEBUG_BUTTON_ID); } catch (err) { btn = null; }
        var text = '';
        try {
            text = JSON.stringify(collectDebug(), null, 2);
        } catch (err) {
            text = JSON.stringify({
                script: SCRIPT_NAME,
                version: SCRIPT_VERSION,
                collectError: err && err.message ? err.message : String(err),
                url: pageUrl(),
                initStage: initStage,
                bootError: bootError
            }, null, 2);
        }
        copyText(text, function (err) {
            if (!btn) return;
            var failed = !!err;
            btn.textContent = failed ? 'Copy failed' : 'Copied';
            setTimeout(function () {
                btn.innerHTML = 'Copy debug<br>v' + SCRIPT_VERSION;
            }, failed ? 2000 : 1500);
        });
    }

    function placeCopyDebugButton() {
        if (!document.body) {
            setTimeout(placeCopyDebugButton, 200);
            return;
        }
        var btn = null;
        try { btn = document.getElementById(DEBUG_BUTTON_ID); } catch (err) { btn = null; }
        if (btn && btn.parentNode === document.body) return;
        if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
        btn = document.createElement('button');
        btn.id = DEBUG_BUTTON_ID;
        btn.type = 'button';
        btn.title = 'Copy a JSON snapshot of this page for debugging the highlighter';
        btn.innerHTML = 'Copy debug<br>v' + SCRIPT_VERSION;
        btn.style.cssText = 'position:fixed; left:12px; bottom:12px; z-index:2147483646; ' +
            'padding:8px 10px; border-radius:8px; cursor:pointer; text-align:left; ' +
            'color:#ffffff; background:#161b22; border:1px solid #8b949e; ' +
            'font:800 11px/1.3 Segoe UI,system-ui,sans-serif; letter-spacing:0.03em; ' +
            'text-transform:uppercase; box-shadow:0 8px 24px rgba(0,0,0,0.45);';
        btn.addEventListener('click', function (e) {
            if (e && e.preventDefault) e.preventDefault();
            if (e && e.stopPropagation) e.stopPropagation();
            copyDebug();
        });
        document.body.appendChild(btn);
        if (typeof GM_registerMenuCommand === 'function') {
            try { GM_registerMenuCommand('Copy debug', copyDebug); } catch (err) { /* menu is optional */ }
        }
    }

    try { placeCopyDebugButton(); }
    catch (err) { bootError = errorInfo(err); bootError.during = 'button'; }

    try {
        initStage = 'match-url';
        urlmatch = document.URL.match(/https:\/\/fclm-portal\.amazon\.com\/.*\/(\w+)\?\S*?&warehouseId=(\w+)/); // used to determine which page we are on
        FC = urlmatch[2];
        initStage = 'storage';
        //Start localStorage if none exists
        if(localStorage.getItem(`highlights_${urlmatch[1]}`) == null ||
           localStorage.getItem(`highlights_${urlmatch[1]}`) == ""){
            localStorage.setItem(`highlights_${urlmatch[1]}`, highlights)
        }else{ // retrieve localStorage and assign it
            highlights = JSON.parse(localStorage.getItem(`highlights_${urlmatch[1]}`))
        }
        initStage = 'switch';
        switch(urlmatch[1]){
            case 'processPathRollup':
                pageBranch = 'processPathRollup';
                processPathRollup()
                break
            case 'functionRollup':
                pageBranch = 'functionRollup';
                // functionRollup()
                break
            case 'timeOnTask':
                pageBranch = 'timeOnTask';
                // timeOnTask()
                break
            case 'node':
                pageBranch = 'node';
                node()
                break
            case 'process':
                pageBranch = 'process';
                break
            case 'ppaTimeOnTask':
                pageBranch = 'ppaTimeOnTask';
                break
            default:
                pageBranch = 'unprogrammed';
                console.log('page not programmed for highlights')
        }
        function processPathRollup(){
            row = document.querySelectorAll('.lineItem')
            addcheckbox(row)
        }
        function functionRollup(){
            row = document.querySelectorAll('.empl-all, .empl-amzn')
            for(var i=0;i<row.length;i++){
                row[i].id = `fr.details.${i}`
            }
            addcheckbox(row)
        }
        function timeOnTask(){
            row = document.querySelectorAll('.tot-row')
            addcheckbox(row)
        }
        function node(){
            var test = document.querySelectorAll('tr')
            console.log(test.length)
            row = document.querySelectorAll('tr.lineItem, tr.line-item-total, tr.core-process-total, tr.main-process-total')
            console.log(row.length)
            for(var i=0;i<row.length;i++){
                row[i].id = `ppa.${i}`
            }
            addcheckbox(row)
        }
        function addcheckbox(row){
        // Create a check box and cell then adds it to the end of the row
            for (var j=0;j<row.length;j++){
                var checkbox = document.createElement('td')
                var input = document.createElement('input')
                input.type = 'checkbox'
                checkbox.appendChild(input)
                row[j].appendChild(checkbox)
                input.addEventListener('change', isChecked)
            }
        }
        function isChecked() {
            if(this.checked){
                this.parentNode.parentNode.classList.add('highlight')
                highlights.push(this.parentNode.parentNode.id) // adds the ID of the table row to the array for localStorage purposes
            }else if(!this.checked){
                this.parentNode.parentNode.classList.remove('highlight')
                for(var i=0;i<highlights.length;i++){
                    if (highlights[i] === this.parentNode.parentNode.id) {
                        highlights.splice(i, 1)
                    }
                }
                for (var c=0;c<this.parentNode.parentNode.children.length;c++){
                    this.parentNode.parentNode.classList.remove('highlight') // remove highlight when unchecked
                    this.parentNode.parentNode.children[c].classList.remove('under100') // remove flashing class when unchecked
                    this.parentNode.parentNode.children[c].classList.remove('over100') // remove green class when unchecked
                }
            }
            localStorage.setItem(`highlights_${urlmatch[1]}`, JSON.stringify(highlights)) //save new arrays in localStorage
            highlightThis()
        }
        function highlightThis(){
            for (var l=0;l<highlights.length;l++){
                for (var i = 0; i < document.getElementById(highlights[l]).childNodes.length; i++) {
                var ratio = document.getElementById(highlights[l]).childNodes[i]
                if (ratio.className == 'numeric ratioToPlan ratio') {
                    /*Determine if the ratio is above or below 100%*/
                    if(parseFloat(ratio.innerText.replace(/,/g, ''),10)>100){
                        ratio.classList.add('over100') //green
                    }else if (parseFloat(ratio.innerText.replace(/,/g, ''),10)<100 && parseFloat(ratio.innerText,10)>0){
                        ratio.classList.add('under100') //red
                    }
                }
            }
                document.getElementById(highlights[l]).classList.add('highlight')
                document.getElementById(highlights[l]).lastElementChild.lastChild.checked = true
            }
        }
        initStage = 'highlight';
        highlightThis()
        // this will make the title row of the tble stick to the top of the page
        initStage = 'sticky';
        var stickyHead = document.getElementsByTagName('thead')[0];
        stickyHead.classList.add('stickyHead')
        for(var g=0;g<stickyHead.children.length;g++){
            for(var h=0;h<stickyHead.children[g].children.length;h++){
                stickyHead.children[g].children[h].style.backgroundClip = "content-box";
            }
        }
           //this makes the header of the page stick to the top when scrolling
           initStage = 'header';
           var header = document.getElementById("fcpn-header")
           header.style.position = 'sticky'
           header.style.top = '0'
           header.style.zIndex ='100000'
        function removeHeader() {
            var removeHead = document.querySelectorAll("div.floatHeader")[0]
            if(removeHead!=null) {
                //removes the weird second header that FCLM has.
                removeHead.remove();
                return;
            }
        }
        initStage = 'float-header';
        waitForKeyElements('div.floatHeader',removeHeader)
        // add the show/hide selector
        initStage = 'visibility';
        var tableRow = document.querySelector('.result-table thead').children[1]
        var visLabel = document.createElement('label')
        var visSpan = document.createElement('span')
        var visCheckbox = document.createElement('input')
        visCheckbox.classList.add('vis--checkbox')
        visCheckbox.id = 'visibility'
        visCheckbox.type='checkbox'
        visCheckbox.addEventListener('click',showHideRows)
        visSpan.classList.add('vis--slider')
        visLabel.classList.add('vis--label')
        visLabel.setAttribute('for','visibility')
        visLabel.title = "Show/hide unchecked rows"
        tableRow.append(visCheckbox)
        visLabel.appendChild(visSpan)
        tableRow.appendChild(visLabel)
        function showHideRows(){
            if(this.checked){ // when toggle is switched to green, remove any unchecked rows on the page
                for(var i=0;i<row.length;i++){
                    if(!highlights.includes(row[i].id)){
                        row[i].classList.add('hideMe')
                    }
                }
            }else if(this.checked == false){ // when toggled to red, show all rows
                for(i=0;i<row.length;i++){
                    row[i].classList.remove('hideMe')
                }
            }
        }
        initStage = 'styles';
        GM_addStyle ( `
    :root {
      --scale: .2;
      --green: #67ff30;
      --red: #fe0000;
    }
.vis--checkbox {
/** Hides the actual checkbox for the slide**/
display: none;
}
.vis--checkbox:checked + .vis--label .vis--label-background {
left: calc(60px * var(--scale));
width: calc(5px * var(--scale));
}
.vis--checkbox:checked + .vis--label .vis--label-background:before {
width: calc(5px * var(--scale));
height: calc(5px * var(--scale));
top: calc(-25px * var(--scale));
}
.vis--checkbox:checked + .vis--label .vis--label-background:after {
width: calc(5px * var(--scale));
height: calc(5px * var(--scale));
left: calc(-30px * var(--scale));
top: calc(20px * var(--scale));
}
.vis--checkbox:checked + .vis--label:before {
background: var(--green);
border-color: #e8e8ea;
animation-name: switch;
animation-duration: 350ms;
animation-fill-mode: forwards;
}
.vis--checkbox:checked + .vis--label:after {
transition-delay: 350ms;
opacity: 1;
}
.vis--label {
cursor: pointer;
width: calc(200px * var(--scale));
height: calc(100px * var(--scale));
background: #e9e9ed;
border-radius: calc(100px * var(--scale));
border: calc(5px * var(--scale)) solid #f3f3f3;
display: flex;
position: relative;
transition: all 350ms ease-in;
}
.vis--label-background {
width: calc(10px * var(--scale));
height: calc(5px * var(--scale));
border-radius: calc(5px * var(--scale));
position: relative;
background: #fff;
left: calc(135px * var(--scale));
top: calc(45px * var(--scale));
transition: all 150ms ease-in;
}
.vis--label-background:before {
content: "";
position: absolute;
top: calc(-5px * var(--scale));
width: calc(40px * var(--scale));
height: calc(5px * var(--scale));
border-radius: calc(5px * var(--scale));
background: orange;
left: calc(-20px * var(--scale));
transition: all 150ms ease-in;
}
.vis--label-background:after {
content: "";
position: absolute;
top: calc(5px * var(--scale));
width: calc(40px * var(--scale));
height: calc(5px * var(--scale));
border-radius: calc(5px * var(--scale));
background: var(--green);
left: calc(-10px * var(--scale));
transition: all 150ms ease-in;
}
.vis--label:before {
animation-name: reverse;
animation-duration: 350ms;
animation-fill-mode: forwards;
transition: all 350ms ease-in;
content: "";
width: calc(82px * var(--scale));
height: calc(82px * var(--scale));
border: calc(5px * var(--scale)) solid #f3f3f3;
top: calc(4px * var(--scale));
left: calc(4px * var(--scale));
position: absolute;
border-radius: calc(82px * var(--scale));
background: var(--red);
}
.vis--label:after {
transition-delay: 0ms;
transition: all 250ms ease-in;
position: absolute;
content: "";
box-shadow: #fff calc(-13px * var(--scale)) 0 0 calc(2px * var(--scale)), #fff calc(-24px * var(--scale)) calc(14px * var(--scale)) 0 calc(-2px * var(--scale));
left: calc(143px * var(--scale));
top: calc(23px * var(--scale));
width: calc(10px * var(--scale));
height: calc(10px * var(--scale));
background: transparent;
border-radius: 50%;
opacity: 0;
}
@keyframes switch {
0% {
  left: calc(4px * var(--scale));
}
60% {
  left: calc(4px * var(--scale));
  width: calc(112px * var(--scale));
}
100% {
  left: calc(104px * var(--scale));
  width: calc(82px * var(--scale));
}
}
@keyframes reverse {
0% {
  left: calc(104px * var(--scale));
  width: calc(82px * var(--scale));
}
60% {
  left: calc(72px * var(--scale));
  width: calc(112px * var(--scale));
}
100% {
  left: calc(4px * var(--scale));
}
}
.highlight{
 background-color: #88ffff !important;
}
.hideMe{
    visibility: collapse;
}
.over100{
    background-color: #afa;
}
.under100 {
    animation: blink 2s ease-in-out infinite;
}
  @keyframes blink {
    0%  {background-color: #faa;}
    50% {background-color: #fff;color:#f00}
    100%{background-color: #faa;}
  }
.stickyHead{
    position:sticky;
    top:36px;
  }
thead th, thead td {
    background-clip: padding-box !important;
    border:1px solid #000 !important;
}
input[type='checkbox']{
cursor:pointer;
}
`);
        initStage = 'ready';
    } catch (err) {
        if (!bootError || bootError.during !== 'button') bootError = errorInfo(err);
    }
})();
