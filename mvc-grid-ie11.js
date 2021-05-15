/*
 * This code has been customised to support IE11
 * When suport ends for IE11 then use official version.
 * */
/*!
 * Mvc.Grid 7.0.0
 *
 * Copyright © NonFactors
 *
 * Licensed under the terms of the MIT License
 * https://www.opensource.org/licenses/mit-license.php
 */
var MvcGrid = /*#__PURE__*/function () {
  function MvcGrid(container) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, MvcGrid);

    var grid = this;
    var element = grid.findGrid(container);

    if (element.dataset.id) {
      return MvcGrid.instances[parseInt(element.dataset.id)].set(options);
    }

    grid.columns = [];
    grid.element = element;
    grid.loadingDelay = 300;
    grid.loadingTimerId = 0;
    grid.name = element.dataset.name;
    grid.controller = new AbortController();
    grid.isAjax = Boolean(element.dataset.url);
    grid.prefix = grid.name ? "".concat(grid.name, "-") : "";
    grid.filterMode = (element.dataset.filterMode || "").toLowerCase();
    element.dataset.id = options.id || MvcGrid.instances.length.toString();
    grid.url = element.dataset.url ? new URL(element.dataset.url, location.href) : new URL(location.href);
    grid.url = options.url ? new URL(options.url.toString(), location.href) : grid.url;
    grid.url = options.query ? new URL("?".concat(options.query), grid.url.href) : grid.url;
    grid.sort = grid.buildSort();
    grid.filters = {
      default: MvcGridFilter,
      date: MvcGridDateFilter,
      guid: MvcGridGuidFilter,
      text: MvcGridTextFilter,
      number: MvcGridNumberFilter
    };
    var headers = element.querySelector(".mvc-grid-headers");
    var rowFilters = element.querySelectorAll(".mvc-grid-row-filters th");

    if (headers) {
      var heads = headers.querySelectorAll("th");
      try {
        for (var i1=0;i1<heads.length;i1++) {
          header = heads[i1];
          grid.columns.push(new MvcGridColumn(grid, header, rowFilters[i1]));
        }
      } catch (err) {
        console.log(err);
      }
    }

    var pager = element.querySelector(".mvc-grid-pager");

    if (pager) {
      grid.pager = new MvcGridPager(grid, pager);
    }

    grid.set(options);
    grid.cleanUp();
    grid.bind();

    if (options.id) {
      MvcGrid.instances[parseInt(options.id)] = grid;
    } else {
      MvcGrid.instances.push(grid);
    }

    if (!element.children.length) {
      grid.reload();
    }
  }

  _createClass(MvcGrid, [{
    key: "set",
    value: function set(options) {
      var grid = this;
      grid.loadingDelay = typeof options.loadingDelay === "undefined" ? grid.loadingDelay : options.loadingDelay;
      grid.url = options.url ? new URL(options.url.toString(), location.href) : grid.url;
      grid.url = options.query ? new URL("?".concat(options.query), grid.url.href) : grid.url;
      grid.isAjax = typeof options.isAjax === "boolean" ? options.isAjax : grid.isAjax;
      grid.filters = Object.assign(grid.filters, options.filters);

      try {
        for (var i2=0;i2<grid.columns.length;i2++) {
          var column = grid.columns[i2];

          if (column.filter && grid.filters[column.filter.name]) {
            column.filter.instance = new grid.filters[column.filter.name](column);
            column.filter.instance.init();
          }
        }
      } catch (err) {
        console.log(err);
      }

      return grid;
    }
  }, {
    key: "showConfiguration",
    value: function showConfiguration(anchor) {
      MvcGridPopup.showConfiguration(this, anchor);
    }
  }, {
    key: "getConfiguration",
    value: function getConfiguration() {
      return {
        name: this.name,
        columns: this.columns.map(function (column) {
          return {
            name: column.name,
            hidden: column.isHidden
          };
        })
      };
    }
  }, {
    key: "configure",
    value: function configure(configuration) {
      var _this = this;

      configuration.columns.forEach(function (column, index) {
        var rows = _this.element.querySelectorAll("tr");

        var i = _this.columns.findIndex(function (col) {
          return col.name.toLowerCase() === column.name.toLowerCase();
        });

        if (i >= 0) {
          _this.columns[i].isHidden = column.hidden;

          try {
            for (var i3=0;i3<rows.length;i3++) {
              var tr = rows[i3];

              if (column.hidden) {
                tr.children[i].classList.add("mvc-grid-hidden");
              } else {
                tr.children[i].classList.remove("mvc-grid-hidden");
              }

              if (i !== index) {
                tr.insertBefore(tr.children[i], tr.children[index]);
              }
            }
          } catch (err) {
            console.log(err);
          }

          _this.columns.splice(i - (index < i ? 1 : 0), 0, _this.columns.splice(index, 1)[0]);
        }
      });
    }
  }, {
    key: "reload",
    value: function reload() {
      var grid = this;

      grid.element.dispatchEvent(new CustomEvent("reloadstart", {
        detail: {
          grid: grid
        },
        bubbles: true
      }));

      if (grid.isAjax) {
        var url = new URL(grid.url.href);
        grid.controller.abort();
        MvcGridPopup.lastActiveElement = null;
        grid.controller = new AbortController();
        url.searchParams.set("_", String(Date.now()));

        if (grid.loadingDelay !== null) {
          var loader = "<td colspan=\"".concat(grid.columns.length, "\"><div class=\"mvc-grid-loader\"><div class=\"mvc-grid-spinner\"></div></div></td>");
          clearTimeout(grid.loadingTimerId);
          grid.loadingTimerId = setTimeout(function () {
            var trs= grid.element.querySelectorAll("tbody > tr");
            try {
              for (var i4=0;i4<trs.length;i4++) {
                var row = trs[i4];
                row.innerHTML = loader;
              }
            } catch (err) {
              console.log(err);
            } 
          }, grid.loadingDelay);
        }

        MvcGridPopup.hide();
        fetch(url.href, {
          signal: grid.controller.signal,
          headers: {
            "X-Requested-With": "XMLHttpRequest"
          }
        }).then(function (response) {
          if (!response.ok) {
            throw new Error("Invalid response status: ".concat(response.status));
          }

          return response.text();
        }).then(function (response) {
          var parent = grid.element.parentElement;
          var template = document.createElement("template");
          var i = Array.from(parent.children).indexOf(grid.element);
          template.innerHTML = response.trim();

          if (template.content.firstElementChild.classList.contains("mvc-grid")) {
            grid.element.outerHTML = response;
          } else {
            throw new Error("Grid partial should only include grid declaration.");
          }

          var newGrid = new MvcGrid(parent.children[i], {
            loadingDelay: grid.loadingDelay,
            id: grid.element.dataset.id,
            filters: grid.filters,
            isAjax: grid.isAjax,
            url: grid.url
          });
          newGrid.element.dispatchEvent(new CustomEvent("reloadend", {
            detail: {
              grid: newGrid
            },
            bubbles: true
          }));
        }).catch(function (reason) {
          if (reason.name === "AbortError") {
            return Promise.resolve();
          }

          var cancelled = !grid.element.dispatchEvent(new CustomEvent("reloadfail", {
            detail: {
              grid: grid,
              reason: reason
            },
            cancelable: true,
            bubbles: true
          }));
          return cancelled ? Promise.resolve() : Promise.reject(reason);
        });
      } else {
        location.href = grid.url.href;
      }
    }
  }, {
    key: "buildSort",
    value: function buildSort() {
      var map = new Map();
      var definitions = /(^|,)(.*?) (asc|desc)(?=$|,)/g;
      var sort = this.url.searchParams.get("".concat(this.prefix, "sort")) || "";
      var match = definitions.exec(sort);

      while (match) {
        map.set(match[2], match[3]);
        match = definitions.exec(sort);
      }

      return map;
    }
  }, {
    key: "findGrid",
    value: function findGrid(element) {
      var grid = closest(element,".mvc-grid");

      if (!grid) {
        throw new Error("Grid can only be created from within mvc-grid structure.");
      }

      return grid;
    }
  }, {
    key: "cleanUp",
    value: function cleanUp() {
      delete this.element.dataset.filterMode;
      delete this.element.dataset.url;
    }
  }, {
    key: "bind",
    value: function bind() {
      var grid = this;

      var trows = grid.element.querySelectorAll("tbody > tr");

      try {
        var _loop = function _loop(row) {

          if (!row.classList.contains("mvc-grid-empty-row")) {
            row.addEventListener("click", function (e) {
              var data = {};

              try {
                for (var i6=0;i6<grid.columns.length;i6++) {
                      column = grid.columns[i6];
                  if (row.cells.length <= i6) {
                    return;
                  }
                  data[column.name] = row.cells[i6].innerText;
                }
              } catch (err) {
               console.log(err);
              }

              this.dispatchEvent(new CustomEvent("rowclick", {
                detail: {
                  grid: grid,
                  data: data,
                  originalEvent: e
                },
                bubbles: true
              }));
            });
          }
        };

        for (var i5=0;i5<trows.length;i5++) {
          _loop(trows[i5]);
        }
      } catch (err) {
        console.log(err);
      }
    }
  }]);

  return MvcGrid;
}();

MvcGrid.instances = [];
MvcGrid.lang = {
  default: {
    "equals": "Equals",
    "not-equals": "Not equals"
  },
  text: {
    "contains": "Contains",
    "equals": "Equals",
    "not-equals": "Not equals",
    "starts-with": "Starts with",
    "ends-with": "Ends with"
  },
  number: {
    "equals": "Equals",
    "not-equals": "Not equals",
    "less-than": "Less than",
    "greater-than": "Greater than",
    "less-than-or-equal": "Less than or equal",
    "greater-than-or-equal": "Greater than or equal"
  },
  date: {
    "equals": "Equals",
    "not-equals": "Not equals",
    "earlier-than": "Earlier than",
    "later-than": "Later than",
    "earlier-than-or-equal": "Earlier than or equal",
    "later-than-or-equal": "Later than or equal"
  },
  guid: {
    "equals": "Equals",
    "not-equals": "Not equals"
  },
  filter: {
    "apply": "&#10003;",
    "remove": "&#10008;"
  },
  operator: {
    "select": "",
    "and": "and",
    "or": "or"
  }
};

var MvcGridColumn = /*#__PURE__*/function () {
  function MvcGridColumn(grid, header, rowFilter) {
    _classCallCheck(this, MvcGridColumn);

    var column = this;
    var data = header.dataset;
    column.grid = grid;
    column.header = header;
    column.name = data.name || "";
    column.isHidden = header.classList.contains("mvc-grid-hidden");
    column.filter = data.filter ? new MvcGridColumnFilter(column, rowFilter) : null;
    column.sort = header.classList.contains("sortable") ? new MvcGridColumnSort(column) : null;
    column.cleanUp();
  }

  _createClass(MvcGridColumn, [{
    key: "cleanUp",
    value: function cleanUp() {
      var data = this.header.dataset;
      delete data.filterDefaultMethod;
      delete data.filterApplied;
      delete data.filterType;
      delete data.filter;
      delete data.sortFirst;
      delete data.sort;
      delete data.name;
    }
  }]);

  return MvcGridColumn;
}();

var MvcGridColumnSort = /*#__PURE__*/function () {
  function MvcGridColumnSort(column) {
    _classCallCheck(this, MvcGridColumnSort);

    var sort = this;
    sort.column = column;
    sort.button = column.header.querySelector(".mvc-grid-sort");
    sort.order = (column.header.dataset.sort || "").toLowerCase();
    sort.first = (column.header.dataset.sortFirst || "asc").toLowerCase();
    sort.bind();
  }

  _createClass(MvcGridColumnSort, [{
    key: "toggle",
    value: function toggle(multi) {
      var sort = this;
      var grid = sort.column.grid;
      var map = sort.column.grid.sort;
      var query = grid.url.searchParams;

      if (sort.order === sort.first) {
        sort.order = sort.order === "asc" ? "desc" : "asc";
      } else if (sort.order) {
        sort.order = "";
      } else {
        sort.order = sort.first;
      }

      if (!multi) {
        map.clear();
      }

      if (sort.order) {
        map.set(sort.column.name, sort.order);
      } else {
        map.delete(sort.column.name);
      }

      var order = Array.from(map).map(function (value) {
        return value.join(" ");
      }).join(",");
      query.delete("".concat(grid.prefix, "sort"));

      if (order) {
        query.set("".concat(grid.prefix, "sort"), order);
      }

      grid.reload();
    }
  }, {
    key: "bind",
    value: function bind() {
      var sort = this;
      var column = sort.column;
      column.header.addEventListener("click", function (e) {
        if (!column.filter || column.grid.filterMode !== "header") {
          if (!/mvc-grid-(sort|filter)/.test(e.target.className)) {
            sort.toggle(e.ctrlKey || e.shiftKey);
          }
        }
      });
      sort.button.addEventListener("click", function (e) {
        sort.toggle(e.ctrlKey || e.shiftKey);
      });
    }
  }]);

  return MvcGridColumnSort;
}();

var MvcGridColumnFilter = /*#__PURE__*/function () {
  function MvcGridColumnFilter(column, rowFilter) {
    _classCallCheck(this, MvcGridColumnFilter);

    var values = [];
    var methods = [];
    var filter = this;
    var data = column.header.dataset;
    var query = column.grid.url.searchParams;
    var name = "".concat(column.grid.prefix + column.name, "-");
    var options = column.header.querySelector(".mvc-grid-options");

    if (column.grid.filterMode === "row") {
      options = rowFilter.querySelector("select");
    }

    if (options && options.classList.contains("mvc-grid-options")) {
      options.parentElement.removeChild(options);
    }

    try {
      for (var i7=0;i7<query.length;i7++) {
        var parameter = query[i7];
        if (parameter[0] !== "".concat(name, "op") && parameter[0].startsWith(name)) {
          methods.push(parameter[0].substring(name.length));
          values.push(parameter[1]);
        }
      }
    } catch (err) {
      console.log(err);
    } 

    filter.column = column;
    filter.rowFilter = rowFilter;
    filter.name = data.filter || "default";
    filter.isApplied = data.filterApplied === "True";
    filter.defaultMethod = data.filterDefaultMethod || "";
    filter.type = (data.filterType || "single").toLowerCase();
    filter.options = options && options.children.length > 0 ? options : null;
    filter.button = (rowFilter || column.header).querySelector(".mvc-grid-filter");
    filter.inlineInput = rowFilter ? rowFilter.querySelector(".mvc-grid-value") : null;
    filter.first = {
      method: methods[0] || "",
      values: filter.type === "multi" ? values : values.slice(0, 1)
    };
    filter.operator = filter.type === "double" ? query.get("".concat(name, "op")) || "" : "";
    filter.second = {
      method: filter.type === "double" ? methods[1] || "" : "",
      values: filter.type === "double" ? values.slice(1, 2) : []
    };
    this.bind();
  }

  _createClass(MvcGridColumnFilter, [{
    key: "apply",
    value: function apply() {
      var _this2 = this;

      var grid = this.column.grid;
      var query = grid.url.searchParams;
      var prefix = this.column.grid.prefix;
      var order = query.get("".concat(prefix, "sort"));

      try {
        for (var i8=0;i8<grid.columns.length;i8++) {
          var column = grid.columns[i8];

          for (var _i2 = 0, _arr2 = _toConsumableArray(query.keys()); _i2 < _arr2.length; _i2++) {
            var key = _arr2[_i2];

            if (key.startsWith("".concat(prefix + column.name, "-"))) {
              query.delete(key);
            }
          }
        }
      } catch (err) {
        console.log(err);
      } 

      query.delete("".concat(prefix, "sort"));
      query.delete("".concat(prefix, "page"));
      query.delete("".concat(prefix, "rows"));

      var _iterator9 = grid.columns.filter(function (col) {
        return col.filter && (col === _this2.column || col.filter.isApplied || col.filter.first.values[0]);
      });

      try {
        for (var i9=0;i9<_iterator9.length; i9++) {
          var _column = _iterator9[i9];
          var filter = _column.filter;
          query.set("".concat(prefix + _column.name, "-").concat(filter.first.method), filter.first.values[0] || "");

          for (var i = 1; filter.type === "multi" && i < filter.first.values.length; i++) {
            query.append("".concat(prefix + _column.name, "-").concat(filter.first.method), filter.first.values[i] || "");
          }

          if (grid.filterMode === "excel" && filter.type === "double") {
            query.set("".concat(prefix + _column.name, "-op"), filter.operator || "");
            query.append("".concat(prefix + _column.name, "-").concat(filter.second.method), filter.second.values[0] || "");
          }
        }
      } catch (err) {
        console.log(err);
      }

      if (order) {
        query.set("".concat(prefix, "sort"), order);
      }

      if (grid.pager && grid.pager.showPageSizes) {
        query.set("".concat(prefix, "rows"), grid.pager.rowsPerPage.value);
      }

      grid.reload();
    }
  }, {
    key: "cancel",
    value: function cancel() {
      var filter = this;
      var column = filter.column;
      var grid = filter.column.grid;
      var query = grid.url.searchParams;

      if (filter.isApplied) {
        query.delete("".concat(grid.prefix, "page"));
        query.delete("".concat(grid.prefix, "rows"));

        for (var _i3 = 0, _arr3 = _toConsumableArray(query.keys()); _i3 < _arr3.length; _i3++) {
          var key = _arr3[_i3];

          if (key.startsWith("".concat(grid.prefix + column.name, "-"))) {
            query.delete(key);
          }
        }

        grid.reload();
      } else {
        filter.first.values = [];
        filter.second.values = [];

        if (column.grid.filterMode !== "excel") {
          filter.inlineInput.value = "";
        }

        MvcGridPopup.hide();
      }
    }
  }, {
    key: "bind",
    value: function bind() {
      var filter = this;
      var column = filter.column;
      var mode = column.grid.filterMode;
      filter.button.addEventListener("click", function () {
        MvcGridPopup.show(filter);
      });

      if (filter.options) {
        if (mode === "row" && filter.type !== "multi") {
          filter.inlineInput.addEventListener("change", function () {
            filter.first.values = [this.value];
            column.filter.apply();
          });
        } else if (mode === "header" || mode === "row") {
          filter.inlineInput.addEventListener("click", function () {
            if (this.selectionStart === this.selectionEnd) {
              MvcGridPopup.show(filter);
            }
          });
        }
      } else if (mode !== "excel") {
        filter.inlineInput.addEventListener("input", function () {
          filter.first.values = [this.value];
          filter.instance.validate(this);
        });
        filter.inlineInput.addEventListener("keyup", function (e) {
          if (e.which === 13 && filter.instance.isValid(this.value)) {
            column.filter.apply();
          }
        });
      }
    }
  }]);

  return MvcGridColumnFilter;
}();

var MvcGridPager = /*#__PURE__*/function () {
  function MvcGridPager(grid, element) {
    _classCallCheck(this, MvcGridPager);

    var pager = this;
    pager.grid = grid;
    pager.element = element;
    pager.totalRows = parseInt(element.dataset.totalRows);
    pager.pages = grid.element.querySelectorAll("[data-page]");
    pager.showPageSizes = element.dataset.showPageSizes === "True";
    pager.rowsPerPage = element.querySelector(".mvc-grid-pager-rows");
    pager.currentPage = pager.pages.length ? parseInt(element.querySelector(".active").dataset.page) : 1;
    pager.cleanUp();
    pager.bind();
  }

  _createClass(MvcGridPager, [{
    key: "apply",
    value: function apply(page, rows) {
      var grid = this.grid;
      var query = grid.url.searchParams;
      query.delete("".concat(grid.prefix, "page"));
      query.delete("".concat(grid.prefix, "rows"));
      query.set("".concat(grid.prefix, "page"), page);

      if (this.showPageSizes) {
        query.set("".concat(grid.prefix, "rows"), typeof rows === "string" ? rows : this.rowsPerPage.value);
      }

      grid.reload();
    }
  }, {
    key: "cleanUp",
    value: function cleanUp() {
      delete this.element.dataset.showPageSizes;
      delete this.element.dataset.totalPages;
      delete this.element.dataset.totalRows;
    }
  }, {
    key: "bind",
    value: function bind() {
      var pager = this;

      try {
        for (var i10=0;i10<pager.pages.length;i10++) {
          var page = pager.pages[i10];
          page.addEventListener("click", function () {
            pager.apply(this.dataset.page);
          });
        }
      } catch (err) {
        _console.log(err);
      }

        var pagerRows = pager.grid.element.querySelectorAll(".mvc-grid-pager-rows");
        for (var pr = 0; pr < pagerRows.length; pr++) {
            pagerRows[pr].addEventListener("change", function () {
          var rows = parseInt(this.value);

          if (!isNaN(rows) && rows >= 0) {
            var totalPages = rows === 0 ? 1 : Math.ceil(pager.totalRows / rows);
            pager.apply(Math.min(pager.currentPage, totalPages).toString(), rows.toString());
          }
        });
        }    
    }
  }]);

  return MvcGridPager;
}();

var MvcGridPopup = /*#__PURE__*/function () {
  function MvcGridPopup() {
    _classCallCheck(this, MvcGridPopup);
  }

  _createClass(MvcGridPopup, null, [{
    key: "showConfiguration",
    value: function showConfiguration(grid, anchor) {
      var popup = this;
      popup.lastActiveElement = document.activeElement;
      popup.element.className = "mvc-grid-popup mvc-grid-configuration";
      popup.element.innerHTML = "<div class=\"popup-arrow\"></div><div class=\"popup-content\"></div>";
      var content = popup.element.querySelector(".popup-content");
      content.appendChild(popup.createDropzone());

      try {
        for (var i11=0;i11<grid.columns.length;i11++) {
          var column = grid.columns[i11];
          content.appendChild(popup.createPreference(column));
          content.appendChild(popup.createDropzone());
        }
      } catch (err) {
        console.log(err);
      }

      if (grid.columns.length) {
        document.body.appendChild(popup.element);
      }

      popup.reposition(grid, anchor);
      popup.bind();
    }
  }, {
    key: "show",
    value: function show(filter) {
      if (!filter.instance) {
        return;
      }

      var popup = this;
      var filterer = filter.instance;
      popup.lastActiveElement = document.activeElement;
      popup.element.className = "mvc-grid-popup ".concat(filterer.cssClasses).trim();
      popup.element.innerHTML = "<div class=\"popup-arrow\"></div><div class=\"popup-content\">".concat(filterer.render(), "</div>");
      document.body.appendChild(popup.element);
      popup.bind();
      popup.setValues(filter);
      popup.reposition(filter.column.grid, filter.button);
      filterer.bindOperator();
      filterer.bindMethods();
      filterer.bindValues();
      filterer.bindActions();
      popup.element.querySelector(".mvc-grid-value").focus();
    }
  }, {
    key: "hide",
    value: function hide(e) {
      var popup = MvcGridPopup;
      var initiator = e && e.target;
      var visible = popup.element.parentNode;
      var outside = !(initiator && closest(initiator,".mvc-grid-popup,.mvc-grid-filter"));

      if (visible && outside) {
        document.body.removeChild(popup.element);

        if (popup.lastActiveElement) {
          popup.lastActiveElement.focus();
          popup.lastActiveElement = null;
        }
      }
    }
  }, {
    key: "setValues",
    value: function setValues(filter) {
      var popup = this;
      popup.setValue(".mvc-grid-operator", [filter.operator]);
      popup.setValue(".mvc-grid-value[data-filter=\"first\"]", filter.first.values);
      popup.setValue(".mvc-grid-value[data-filter=\"second\"]", filter.second.values);
      popup.setValue(".mvc-grid-method[data-filter=\"first\"]", [filter.first.method]);
      popup.setValue(".mvc-grid-method[data-filter=\"second\"]", [filter.second.method]);
    }
  }, {
    key: "setValue",
    value: function setValue(selector, values) {
      var input = this.element.querySelector(selector);

      if (input) {
        if (input.tagName === "SELECT" && input.multiple) {
          for (var _i4 = 0, _Array$from = Array.from(input.options); _i4 < _Array$from.length; _i4++) {
            var option = _Array$from[_i4];
            option.selected = values.indexOf(option.value) >= 0;
          }
        } else {
          input.value = values[0] || "";
        }
      }
    }
  }, {
    key: "createPreference",
    value: function createPreference(column) {
      var popup = this;
      var name = document.createElement("span");
      var checkbox = document.createElement("input");
      var preference = document.createElement("label");
      checkbox.type = "checkbox";
      preference.draggable = true;
      preference.className = "mvc-grid-column";

      if (column.filter && column.filter.inlineInput) {
        name.innerText = column.filter.inlineInput.placeholder;
      } else {
        name.innerText = column.header.innerText.trim();
      }

      checkbox.checked = !column.isHidden;
      checkbox.addEventListener("change", function () {
        var i = column.grid.columns.indexOf(column);

        var _iterator12 = olumn.grid.element.querySelectorAll("tr");

        try {
          for (var i12=0;i12<_iterator12.length;i12++) {
            var tr = _iterator12[i12];

            if (checkbox.checked) {
              tr.children[i].classList.remove("mvc-grid-hidden");
            } else {
              tr.children[i].classList.add("mvc-grid-hidden");
            }
          }
        } catch (err) {
          console.log(err);
        }

        column.isHidden = !checkbox.checked;
        column.grid.element.dispatchEvent(new CustomEvent("gridconfigure", {
          detail: {
            grid: column.grid
          },
          bubbles: true
        }));
      });
      preference.addEventListener("dragstart", function () {
        popup.draggedColumn = column;
        popup.draggedElement = preference;
        preference.style.opacity = "0.4";
        preference.parentElement.classList.add("mvc-grid-dragging");
      });
      preference.addEventListener("dragend", function () {
        popup.draggedColumn = null;
        popup.draggedElement = null;
        preference.style.opacity = "";
        preference.parentElement.classList.remove("mvc-grid-dragging");
      });
      preference.appendChild(checkbox);
      preference.appendChild(name);
      return preference;
    }
  }, {
    key: "createDropzone",
    value: function createDropzone() {
      var _this3 = this;

      var dropzone = document.createElement("div");
      dropzone.className = "mvc-grid-dropzone";
      dropzone.addEventListener("dragenter", function () {
        dropzone.classList.add("hover");
      });
      dropzone.addEventListener("dragover", function (e) {
        e.preventDefault();
      });
      dropzone.addEventListener("dragleave", function () {
        dropzone.classList.remove("hover");
      });
      dropzone.addEventListener("drop", function () {
        var popup = _this3;
        var dragged = popup.draggedElement;
        var grid = popup.draggedColumn.grid;

        if (dropzone !== dragged.previousElementSibling && dropzone !== dragged.nextElementSibling) {
          var index = Array.from(popup.element.querySelectorAll(".mvc-grid-dropzone")).indexOf(dropzone);
          var i = grid.columns.indexOf(popup.draggedColumn);
          dropzone.parentElement.insertBefore(dragged.previousElementSibling, dropzone);
          dropzone.parentElement.insertBefore(dragged, dropzone);

          var _iterator13 = grid.element.querySelectorAll("tr");

          try {
            for (var i13=0;i13<_iterator13.length;i13++) {
              var tr = _iterator13[i13];
              tr.insertBefore(tr.children[i], tr.children[index]);
            }
          } catch (err) {
            console.log(err);
          } finally {
            _iterator13.f();
          }

          grid.columns.splice(index - (i < index ? 1 : 0), 0, grid.columns.splice(i, 1)[0]);
          grid.element.dispatchEvent(new CustomEvent("gridconfigure", {
            detail: {
              grid: grid
            },
            bubbles: true
          }));
        }

        dropzone.classList.remove("hover");
      });
      return dropzone;
    }
  }, {
    key: "reposition",
    value: function reposition(grid, anchor) {
      var element = this.element;
      var style = getComputedStyle(element);
      var arrow = element.querySelector(".popup-arrow");

      var _getBoundingClientRec = (anchor || grid.element).getBoundingClientRect(),
          top = _getBoundingClientRec.top,
          left = _getBoundingClientRec.left;

      top += window.pageYOffset - parseFloat(style.borderTopWidth);
      left += window.pageXOffset - parseFloat(style.borderLeftWidth);

      if (anchor) {
        left -= parseFloat(style.marginLeft) - anchor.offsetWidth / 2 + 26;
        var arrowLeft = 26 - parseFloat(getComputedStyle(arrow).borderLeftWidth);
        var width = parseFloat(style.marginLeft) + element.offsetWidth + parseFloat(style.marginRight);
        var offset = Math.max(0, left + width - window.pageXOffset - document.documentElement.clientWidth);
        top += anchor.offsetHeight / 3 * 2 + arrow.offsetHeight - parseFloat(style.marginTop);
        arrow.style.left = "".concat(Math.max(0, arrowLeft + offset), "px");
        left -= offset;
      }

      element.style.left = "".concat(Math.max(0, left), "px");
      element.style.top = "".concat(Math.max(0, top), "px");
      arrow.style.display = anchor ? "" : "none";
    }
  }, {
    key: "bind",
    value: function bind() {
      var popup = this;
      window.addEventListener("mousedown", popup.hide);
      window.addEventListener("touchstart", popup.hide);
    }
  }]);

  return MvcGridPopup;
}();

MvcGridPopup.element = document.createElement("div");

var MvcGridFilter = /*#__PURE__*/function () {
  function MvcGridFilter(column) {
    _classCallCheck(this, MvcGridFilter);

    var filter = this;
    filter.column = column;
    filter.type = column.filter.type;
    filter.mode = column.grid.filterMode;
    filter.methods = ["equals", "not-equals"];
    filter.cssClasses = "mvc-grid-default-filter";
  }

  _createClass(MvcGridFilter, [{
    key: "init",
    value: function init() {
      var filter = this;
      var column = filter.column;
      var columnFilter = column.filter;

      if (!columnFilter.options && filter.mode !== "excel") {
        filter.validate(columnFilter.inlineInput);
      }

      if (!columnFilter.first.method) {
        columnFilter.first.method = columnFilter.defaultMethod;
      }

      if (!columnFilter.second.method) {
        columnFilter.second.method = columnFilter.defaultMethod;
      }

      if (filter.methods.indexOf(columnFilter.first.method) < 0) {
        columnFilter.first.method = filter.methods[0];
      }

      if (filter.methods.indexOf(columnFilter.second.method) < 0) {
        columnFilter.second.method = filter.methods[0];
      }
    }
  }, {
    key: "isValid",
    value: function isValid(value) {
      return !value || true;
    }
  }, {
    key: "validate",
    value: function validate(input) {
      if (this.isValid(input.value)) {
        input.classList.remove("invalid");
      } else {
        input.classList.add("invalid");
      }
    }
  }, {
    key: "render",
    value: function render() {
      var filter = this;
      return "<div class=\"popup-filter\">\n                    ".concat(filter.renderFilter("first"), "\n                </div>\n                ").concat(filter.mode === "excel" && filter.type === "double" ? "".concat(filter.renderOperator(), "\n                    <div class=\"popup-filter\">\n                        ").concat(filter.renderFilter("second"), "\n                    </div>") : "", "\n                ").concat(filter.renderActions());
    }
  }, {
    key: "renderFilter",
    value: function renderFilter(name) {
      var filter = this;
      var options = filter.column.filter.options;
      var lang = MvcGrid.lang[filter.column.filter.name] || {};
      var multiple = filter.type === "multi" ? " multiple" : "";
      var methods = filter.methods.map(function (method) {
        return "<option value=\"".concat(method, "\">").concat(lang[method] || "", "</option>");
      }).join("");
      return "<div class=\"popup-group\">\n                    <select class=\"mvc-grid-method\" data-filter=\"".concat(name, "\">\n                        ").concat(methods, "\n                    </select>\n                </div>\n                <div class=\"popup-group\">").concat(options ? "<select class=\"mvc-grid-value\" data-filter=\"".concat(name, "\"").concat(multiple, ">\n                          ").concat(options.innerHTML, "\n                       </select>") : "<input class=\"mvc-grid-value\" data-filter=\"".concat(name, "\">"), "\n                </div>");
    }
  }, {
    key: "renderOperator",
    value: function renderOperator() {
      var lang = MvcGrid.lang.operator;
      return "<div class=\"popup-operator\">\n                    <div class=\"popup-group\">\n                        <select class=\"mvc-grid-operator\">\n                            <option value=\"\">".concat(lang.select, "</option>\n                            <option value=\"and\">").concat(lang.and, "</option>\n                            <option value=\"or\">").concat(lang.or, "</option>\n                        </select>\n                    </div>\n                </div>");
    }
  }, {
    key: "renderActions",
    value: function renderActions() {
      var lang = MvcGrid.lang.filter;
      return "<div class=\"popup-actions\">\n                    <button type=\"button\" class=\"mvc-grid-apply\" type=\"button\">".concat(lang.apply, "</button>\n                    <button type=\"button\" class=\"mvc-grid-cancel\" type=\"button\">").concat(lang.remove, "</button>\n                </div>");
    }
  }, {
    key: "bindOperator",
    value: function bindOperator() {
      var filter = this.column.filter;
      var operator = MvcGridPopup.element.querySelector(".mvc-grid-operator");

      if (operator) {
        operator.addEventListener("change", function () {
          filter.operator = this.value;
        });
      }
    }
  }, {
    key: "bindMethods",
    value: function bindMethods() {
      var filter = this.column.filter;

      var _iterator14 = MvcGridPopup.element.querySelectorAll(".mvc-grid-method");

      try {
        for (var i14=0;i14<heads.length;i14++) {
          var method = _iterator14[i14];
          method.addEventListener("change", function () {
            filter[this.dataset.filter].method = this.value;
          });
        }
      } catch (err) {
        console.log(err);
      }
    }
  }, {
    key: "bindValues",
    value: function bindValues() {
      var filter = this;

      var _iterator15 = MvcGridPopup.element.querySelectorAll(".mvc-grid-value");

      try {
        var _loop2 = function _loop2(input) {

          if (input.tagName === "SELECT") {
            input.addEventListener("change", function () {
              var options = Array.from(input.options).filter(function (option) {
                return option.selected;
              });
              filter.column.filter[input.dataset.filter].values = options.map(function (option) {
                return option.value;
              });

              if (filter.mode !== "excel") {
                var inlineInput = filter.column.filter.inlineInput;

                if (filter.mode === "header" || filter.type === "multi") {
                  inlineInput.value = options.map(function (option) {
                    return option.text;
                  }).join(", ");
                } else {
                  inlineInput.value = input.value;
                }

                filter.validate(inlineInput);
              }
            });
          } else {
            input.addEventListener("input", function () {
              filter.column.filter[input.dataset.filter].values = [input.value];

              if (filter.mode !== "excel") {
                var inlineInput = filter.column.filter.inlineInput;
                inlineInput.value = filter.column.filter[input.dataset.filter].values.join(", ");
                filter.validate(inlineInput);
              }

              filter.validate(input);
            });
            input.addEventListener("keyup", function (e) {
              if (e.which === 13 && filter.isValid(this.value)) {
                filter.column.filter.apply();
              }
            });
            filter.validate(input);
          }
        };

        for (var i15=0;i15<_iterator15.length;i15++) {
          _loop2(_iterator15[i15]);
        }
      } catch (err) {
        console.log(err);
      }
    }
  }, {
    key: "bindActions",
    value: function bindActions() {
      var filter = this.column.filter;
      var popup = MvcGridPopup.element;
      popup.querySelector(".mvc-grid-apply").addEventListener("click", filter.apply.bind(filter));
      popup.querySelector(".mvc-grid-cancel").addEventListener("click", filter.cancel.bind(filter));
    }
  }]);

  return MvcGridFilter;
}();

var MvcGridTextFilter = /*#__PURE__*/function (_MvcGridFilter) {
  _inherits(MvcGridTextFilter, _MvcGridFilter);

  var _super = _createSuper(MvcGridTextFilter);

  function MvcGridTextFilter(column) {
    var _this4;

    _classCallCheck(this, MvcGridTextFilter);

    _this4 = _super.call(this, column);
    _this4.cssClasses = "mvc-grid-text-filter";
    _this4.methods = ["contains", "equals", "not-equals", "starts-with", "ends-with"];
    return _this4;
  }

  return MvcGridTextFilter;
}(MvcGridFilter);

var MvcGridNumberFilter = /*#__PURE__*/function (_MvcGridFilter2) {
  _inherits(MvcGridNumberFilter, _MvcGridFilter2);

  var _super2 = _createSuper(MvcGridNumberFilter);

  function MvcGridNumberFilter(column) {
    var _this5;

    _classCallCheck(this, MvcGridNumberFilter);

    _this5 = _super2.call(this, column);
    _this5.cssClasses = "mvc-grid-number-filter";
    _this5.methods = ["equals", "not-equals", "less-than", "greater-than", "less-than-or-equal", "greater-than-or-equal"];
    return _this5;
  }

  _createClass(MvcGridNumberFilter, [{
    key: "isValid",
    value: function isValid(value) {
      return !value || /^(?=.*\d+.*)[-+]?\d*[.,]?\d*$/.test(value);
    }
  }]);

  return MvcGridNumberFilter;
}(MvcGridFilter);

var MvcGridDateFilter = /*#__PURE__*/function (_MvcGridFilter3) {
  _inherits(MvcGridDateFilter, _MvcGridFilter3);

  var _super3 = _createSuper(MvcGridDateFilter);

  function MvcGridDateFilter(column) {
    var _this6;

    _classCallCheck(this, MvcGridDateFilter);

    _this6 = _super3.call(this, column);
    _this6.cssClasses = "mvc-grid-date-filter";
    _this6.methods = ["equals", "not-equals", "earlier-than", "later-than", "earlier-than-or-equal", "later-than-or-equal"];
    return _this6;
  }

  return MvcGridDateFilter;
}(MvcGridFilter);

var MvcGridGuidFilter = /*#__PURE__*/function (_MvcGridFilter4) {
  _inherits(MvcGridGuidFilter, _MvcGridFilter4);

  var _super4 = _createSuper(MvcGridGuidFilter);

  function MvcGridGuidFilter(column) {
    var _this7;

    _classCallCheck(this, MvcGridGuidFilter);

    _this7 = _super4.call(this, column);
    _this7.cssClasses = "mvc-grid-guid-filter";
    return _this7;
  }

  _createClass(MvcGridGuidFilter, [{
    key: "isValid",
    value: function isValid(value) {
      return !value || /^[0-9A-F]{8}[-]?([0-9A-F]{4}[-]?){3}[0-9A-F]{12}$/i.test(value);
    }
  }]);

  return MvcGridGuidFilter;
}(MvcGridFilter);