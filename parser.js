// ------------------------------------------------------------------------------
// Chrome Bookmarks Viewer
// 
// List the content of Chrome's bookmarks json file.
// Allows to sort bookmarks by text, date or url.
//
// History
// 2021-05-14	jbress	created based on https://github.com/mattCreative/chrome-bookmarks-converter/blob/master/convertor.php
// ------------------------------------------------------------------------------

var CBC;

(function (_this)
{
	"use strict";

	// can use navigator.language instead
	const PreferredLocale = "fr-CH";

	// all generated items, indexed by id
	let _renderedItems = {};



	/**
	 * Generate date information element
	 */
	function renderDate(item)
	{
		// see also item.date_modified
		return '<span class="date">' +
			(item.date_added ? formatDate(cbdt2Date(item.date_added)) : "") + 
			'</span>';
	}



	function updateIndexItem(item)
	{
		if (item.id)
		{
			let old = _renderedItems[item.id];
			if (old != null)
				console.warn("An item with id '" + item.id + "' was already indexed: new item take precedence", old, item);

			_renderedItems[item.id] = item;
		}
	}



	/**
	 * @param out			output object
	 * @param item			input item
	 * @param fillOutItems	true tells to update _renderedItems
	 */
	function renderFolder(out, item, fillOutItems = false, sortBy = null)
	{
		// item.type = "folder"
		out.html +=
			'<dl id="item-' + item.id + '"><span class="title">' + htmlEncode(item.name) + '</span>' +
			'<span class="sort-btn' + (sortBy === "text" ? " active" : "") + '" sortby="text" title="Sort by text">T</span>' +
			'<span class="sort-btn' + (sortBy === "date" ? " active" : "") + '" sortby="date" title="Sort by date">D</span>' +
			'<span class="sort-btn' + (sortBy === "url" ? " active" : "") + '" sortby="url"  title="Sort by url" >U</span>' +
			'<span class="sort-btn' + (sortBy == null || sortBy === "org" ? " active" : "") + '" sortby="org"  title="Original sorting" >O</span>' +
			renderDate(item)
			;

		renderItems(out, item.children, fillOutItems, sortBy);

		out.html += '</dl>';

		if (fillOutItems)
			updateIndexItem(item);
	}



	function renderUrlItem(out, item, fillOutItems)
	{
		// item.type = "url"
		out.html += '<dt id="item-' + item.id + '"><a href="' + item.url + '">' + htmlEncode(item.name) + '</a>' + renderDate(item) + '</dt>';

		if (fillOutItems)
			updateIndexItem(item);
	}



	/**
	 * Generate html for given items recursively
	 * 
	 * @param out	output object
	 * @param items	input items
	 */
	function renderItems(out, items, fillOutItems, sortBy)
	{
		switch (sortBy)
		{
			case "date":
				(items = items.slice()).sort((a, b) => { return compareString((a.date_added || "").toLowerCase(), (b.date_added || "").toLowerCase()); });
				break;

			case "url":
				(items = items.slice()).sort((a, b) => { return compareString((a.url || "").toLowerCase(), (b.url || "").toLowerCase()); });
				break;

			case "text":
				(items = items.slice()).sort((a, b) => { return compareString((a.name || "").toLowerCase(), (b.name || "").toLowerCase()); });
				break;

			default: // null, "org"
				// keep original sorting
				break;
		}

		for (const item of items)
			if (item.children)
				renderFolder(out, item, fillOutItems, sortBy);
			else if (item.url)
				renderUrlItem(out, item, fillOutItems);
	}



	function onSortClick(e)
	{
		const
			el = $(e.currentTarget),
			sortBy = el.attr("sortby"),
			ui = el.parent(), // existing container (DL element)
			itemId = (ui.attr("id") || "").replace("item-", ""), // extract N in "item-N"
			data = _renderedItems[itemId],
			out = { html: "" }
			;

		if (!data)
		{
			console.warn("Could not find item with id '" + itemId + "'");
			return;
		}

		ui.html("");

		renderFolder(out, data, false, sortBy);

		// insert new container+content after existing container
		ui.after(out.html);

		ui.remove();

		highlight($("#item-" + itemId));
	}



	function renderAll(data)
	{
		let result = $("#result"),
			out = { html: "" },
			item
			;

		result.off("click", ".sort-btn").on("click", ".sort-btn", onSortClick);

		result.html("");

		_renderedItems = {};

		if ((item = data.roots.bookmark_bar) != null)
			renderFolder(out, item, true);

		if ((item = data.roots.other) != null)
			renderFolder(out, item, true);

		result.html(out.html);
	}



	$("#btnLoad").on("click", function (e)
	{
		if ((typeof window.FileReader) !== "function")
		{
			alert("The file API isn't supported on this browser. Please use a more modern browser.")
			return;
		}

		const fileInput = document.getElementById("fileinput");

		if (!(fileInput && fileInput.files))
		{
			alert("This browser doesn't seem to support the 'files' property of file inputs.")
			return;
		}

		if (!fileInput.files[0])
		{
			alert("Please select a file before clicking 'Load'");
			return;
		}

		const file = fileInput.files[0];

		const reader = new FileReader();

		reader.onload = function (ev)
		{
			let content = ev.target.result,
				data = JSON.parse(content)
				;

			renderAll(data);
		};

		reader.readAsText(file, "utf8");
	});



	/**
	 * Chrome Bookmark datetime value to date
	 * https://stackoverflow.com/questions/51343828/how-to-parse-chrome-bookmarks-date-added-value-to-a-date/51343829#51343829
	 * 
	 * @param {string} value	datetime value
	 */
	function cbdt2Date(value)
	{
		// -11644473600000 = Date.UTC(1601, 0, 1)
		return new Date(-11644473600000 + parseInt(value) / 1000);
	}



	function compareString(a, b)
	{
		if (a == null && b == null)
			return 0;
		if (a == null)
			return -1;
		if (b == null)
			return 1;
		if (a < b)
			return -1;
		if (a > b)
			return 1;
		return 0;
	}



	function formatDate(date)
	{
		return date.toLocaleString(PreferredLocale, { year: "numeric", month: "numeric", day: "numeric" });
	}



	let _htmlEncodeEl;

	function htmlEncode(str)
	{
		if (_htmlEncodeEl === undefined)
			_htmlEncodeEl = document.createElement("div");

		_htmlEncodeEl.textContent = str;

		return _htmlEncodeEl.innerHTML;
	}



	// Based on https://stackoverflow.com/questions/848797/yellow-fade-effect-with-jquery/35174486#35174486

	let _highlightFxLoaded = false;

	function highlight(el)
	{
		const duration = 1000;

		if (!_highlightFxLoaded)
		{
			$("head").append("<style>@keyframes highlightFxAnim { from { background: #ffff99; } to { background: transparent; } } .item-highlight { animation: highlightFxAnim " + duration + "ms; }</style>");
			_highlightFxLoaded = true;
		}

		let timerId = el.data("highlightFxTID");
		if (timerId)
		{
			clearTimeout(timerId);
			el.removeClass("item-highlight");
		}

		el.addClass("item-highlight");

		timerId = setTimeout((el0) =>
		{
			el0.removeClass("item-highlight");
			el0.data("highlightFxTID", null);
		}, duration, el);

		el.data("highlightFxTID", timerId);
	}


})(CBC || (CBC = {}));