/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ubiquity.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *   Sander Dijkhuis <sander.dijkhuis@gmail.com>
 *   Stefan Thomas <justmoon@members.fsf.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * # App #
 */
/**
 * This is the application that processes the code and lets the user
 * navigate through and read the documentation.
 */
var App = {
	options : {}
};

/**
 * **`App.trim()`**
 *
 * Returns `str` without whitespace at the beginning and the end.
 */
App.trim = function trim(str) {
	return str.replace(/^\s+|\s+$/g,"");
};

/**
 * **`App.processors`**
 *
 * An array of user-defined processor functions.  They should take one
 * argument, the DOM node containing the documentation.  User-defined
 * processor functions are called after standard processing is done.
 */
App.processors = [];

App.menuItems = {};   // Has a {label, urlOrCallback} dict for each keyword.

/**
 * **`App.processCode()`**
 *
 * Splits `code` in documented blocks and puts them in `div`.
 * The used structure for each block is:
 *
 *     <div class="documentation"> (...) </div>
 *     <div class="code"> (...) </div>
 *     <div class="divider"/>
 *
 * There are three supported ways of parsing documentation,
 * first working is used:
 *
 * 1. [Markdown] using [Showdown]
 * 2. [Creole]
 * 3. as fallback, documentation is rendered in `<pre>` tags.
 *
 * [Markdown]: http://daringfireball.net/projects/markdown/
 * [Showdown]: https://github.com/coreyti/showdown
 * [Creole]:   http://www.wikicreole.org/wiki/
 */
App.processCode = function processCode(code, div) {
	var lines = code.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
	var blocks = [];
	var blockText = "";
	var codeText = "";
	var firstCommentLine;
	var lastCommentLine;
	var _lineNum;
	var renderDoc; // parsed docblock text rendering function

	function maybeAppendBlock() {
		if (blockText){
			blocks.push({text: blockText,
						 lineno: firstCommentLine,
						 numLines: lastCommentLine - firstCommentLine + 1,
						 lastCode : _lineNum,
						 code: codeText});
		}
	}

	var inComment = false;
	jQuery.each(
		lines,
		function(lineNum) {
			var startIndex, text;
			var line = this;
			var isCode = true;
			var isStartComment = (App.trim(line).indexOf("/**") == 0);
			var isEndComment = ~line.indexOf("*/");
			if (inComment) {
				text = App.trim(line);
				if (text.charAt(0) == "*") {
					text = text.slice(1);
					if (text.charAt(0) == " ") text = text.slice(1);
				}
				if (isEndComment) {
					lastCommentLine += 1;
					isCode = false;
					inComment = false;
				} else if (lineNum == lastCommentLine + 1) {
					blockText += text + "\n";
					lastCommentLine += 1;
					isCode = false;
				}
			} else if (isStartComment) {
				startIndex = line.indexOf("/**");
				text = App.trim(line.slice(startIndex + 3));

				maybeAppendBlock();
				firstCommentLine = lineNum;
				lastCommentLine = lineNum;
				blockText = text + "\n";
				codeText = "";
				isCode = false;
				inComment = true;
			}
			if (isCode)
				codeText += line + "\r\n";

			_lineNum = lineNum + 1;
		});
	maybeAppendBlock();

	if (typeof Showdown != "undefined")
	{
		var showdown = new Showdown.converter();
		renderDoc = function (output, text)
		{
			output.html(showdown.makeHtml(text));
		}
	}
	else if (typeof Parse != "undefined" && typeof Parse.Simple != "undefined" && typeof Parse.Simple.Creole != "undefined")
	{
		var creole = new Parse.Simple.Creole(
		{
			forIE: document.all,
			interwiki: {
				WikiCreole: 'http://www.wikicreole.org/wiki/',
				Wikipedia: 'http://en.wikipedia.org/wiki/'
			},
			linkFormat: ''
		});
		renderDoc = function (output, text)
		{
			creole.parse(output.get(0), text);
		}
	}
	else
	{
		renderDoc = function (output, text)
		{
			$('<pre />', {text: text}).wrap('<div />').appendTo(output);
		}
	}

	var cont = [];
	var headers = ['h1', 'h2', 'h3', 'h4', "strong"];

	jQuery.each(
		blocks,
		function(i) {
			var docs = $('<div class="documentation">');
			docs.css(App.colDocCss);
			renderDoc(docs, this.text);

			for(var h in headers){
				var hd = headers[h];
				if (docs.find(hd).length > 0){
					var titl = docs.find(hd)
					titl.attr('id', titl.text().replace(/ /g, "_"));
					cont.push([titl.attr('id'), hd, titl]);
				}
			}
			$(div).append(docs);
			var code = $('<code class="code prettyprint">');
			code.css(App.colCodeCss);
			code.text(this.code);
			code.insertBefore(docs);

			var num = $('<div class = "nums">');
			for (var x = this.lineno + this.numLines +1; x<this.lastCode; x++){
				num.append(x + ' \n');
			}
			num.css(App.colNumCss);
			num.insertBefore(docs);

			var docsSurplus = docs.outerHeight(true) - code.outerHeight(true) + App.charHeight;
			if (docsSurplus > 0){
				code.css({paddingBottom: 9+docsSurplus + "px"});
				num.css({paddingBottom: 9+docsSurplus + "px"})
			}
			$(div).append('<div class="divider">');
		});

	// Run the user-defined processors.
	jQuery.each(
		App.processors,
		function(i) {
			App.processors[i]($(div).find(".documentation"));
		});

	/*
	// == Table Of Contents ==
	var ul = $("<ul class = 'toc' />");
	for (var k in cont){
		var ln = $("<li class = '" + cont[k][1] + "'>" +
				   "<span class = 'pseudo-link' href = '" + cont[k][0] +
				   "'>" + cont[k][2].text() + "</span></li>");
		ul.append(ln);
	}
	div.prepend(ul);
	*/

};

/**
 * **`App.addMenuItem()`**
 *
 * Adds a menu item to the `element` DOM node showing the `label`
 * text. If `urlOrCallback` is an URL, choosing the item causes a new
 * window to be opened with that URL.  If it's a function, it will be called
 * when choosing the item.
 *
 * If the node does not have a menu yet, one will be created.
 */
App.addMenuItem = function addMenuItem(element, label, urlOrCallback) {
	var text = $(element).text();

	if (!$(element).parent().hasClass("popup-enabled")) {
		App.menuItems[text] = [];

		$(element).wrap('<span class="popup-enabled"></span>');

		$(element).mousedown(
			function(evt) {
				evt.preventDefault();
				var popup = $('<div class="popup"></div>');

				function addItemToPopup(label, urlOrCallback) {
					var callback;
					var menuItem = $('<div class="item"></div>');
					menuItem.text(label);
					function onOverOrOut() { $(this).toggleClass("selected"); }
					menuItem.mouseover(onOverOrOut);
					menuItem.mouseout(onOverOrOut);
					if (typeof(urlOrCallback) == "string")
						callback = function() {
							window.open(urlOrCallback);
						};
					else
						callback = urlOrCallback;
					menuItem.mouseup(callback);
					popup.append(menuItem);
				}

				jQuery.each(
					App.menuItems[text],
					function(i) {
						var item = App.menuItems[text][i];
						addItemToPopup(item.label, item.urlOrCallback);
					});

				popup.find(".item:last").addClass("bottom");

				popup.css({left: evt.pageX + "px"});
				$(window).mouseup(
					function mouseup() {
						popup.remove();
						$(window).unbind("mouseup", mouseup);
					});
				$(this).append(popup);
			});
	}

	App.menuItems[text].push({ label: label, urlOrCallback: urlOrCallback });
};

App.currentPage = null;

App.pages = {};

/**
 * **`App.navigate()`**
 *
 * Navigates to a different view if needed.  The appropriate view is
 * fetched from the URL hash.  If that is empty, the original page content
 * is shown.
 */
App.navigate = function navigate() {
	var newPage;
	if (window.location.hash)
		newPage = window.location.hash.slice(1);
	else
		newPage = "overview";

	if (App.currentPage != newPage) {
		if (App.currentPage)
			$(App.pages[App.currentPage]).hide();
		if (!App.pages[newPage]) {
			var newDiv = $("<div>");
			newDiv.attr("name", newPage);
			$("#content").append(newDiv);
			App.pages[newPage] = newDiv;
			jQuery.get(newPage,
					   {},
					   function(code) {
						   App.processCode(code, newDiv);
						   if (typeof prettyPrint != "undefined")
						      prettyPrint();
						   App.updateBreadcrumbs();
					   },
					   "text");
		}
		$(App.pages[newPage]).show();
		App.currentPage = newPage;
		App.updateBreadcrumbs();
	}
};

App.updateBreadcrumbs = function updateBreadcrumbs()
{
	var breadcrumbsEl = $('#menubar .breadcrumbs');
	breadcrumbsEl.html('');
	var path = [{
		label: $('title').text(),
		link: ''
	}];

	if (App.currentPage != "overview") {
		var label = App.pages[App.currentPage].find('h1').eq(0).text();
		if (!label.length) label = App.pages[App.currentPage].attr('name');
		path.push({
			label: label,
			link: App.pages[App.currentPage].attr('name')
		});
	}

	$.each(path, function (index, value) {
		var item = $('<li></li>').appendTo(breadcrumbsEl);
		var link = $('<a></a>').appendTo(item);
		link.attr('href', '#'+value.link);
		link.text(value.label);
		if (index == 0) link.addClass('root');
	});
};

App.CHARS_PER_ROW = 80;

App.initColumnSizes = function initSizes() {
	// Get the width of a single monospaced character of code.
	var oneCodeCharacter = $('<div class="code">M</div>');
	$("#content").append(oneCodeCharacter);
	App.charWidth = oneCodeCharacter.width();
	App.charHeight = oneCodeCharacter.height();
	App.columnWidth = App.charWidth * App.CHARS_PER_ROW;
	$(oneCodeCharacter).remove();

	App.colCodeCss = {width: App.columnWidth};
	App.colNumCss = {width: App.charWidth * 7};
	App.colDocCss = {paddingRight: App.columnWidth + App.charWidth * 7 + 10};

	$('.documentation').css(App.colDocCss);
	$('.nums').css(App.colNumCss);
	$('.code').css(App.colCodeCss);
};

App.initMenuBar = function initMenuBar() {
	var outerEl = $('<div id="menubar_o"></div>').prependTo('body');
	var menuBarEl = $('<div id="menubar"></div>').appendTo(outerEl);
	var breadcrumbsEl = $('<ul class="breadcrumbs"></ul>').appendTo(menuBarEl);

	breadcrumbsEl.find('a').live('click', function () {
		console.log('test');
		$('html, body').animate({scrollTop:0}, 1200, 'linear');
	});

	$('<div class="clear"></div>').appendTo(menuBarEl);
};

$(function() {
	$('.pseudo-link').live('click', function(){
		console.log(this);
	});
	App.pages["overview"] = $("#overview").get(0);
	App.initMenuBar();
	App.initColumnSizes();
	window.setInterval(
		function() {
			App.navigate();
		},
		100
	);
	App.navigate();
});
