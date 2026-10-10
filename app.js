(() => {
  "use strict";

  const STORAGE_KEY = "fishbase.records.v1";
  const FIELDS = ["name", "map", "location", "bait", "time", "tackle", "depth", "notes"];
  const FIELD_LABELS = {
    name: "Назва риби", map: "Карта", location: "Локація", bait: "Наживка",
    time: "Час", tackle: "Тип снасті", depth: "Глибина", notes: "Примітка"
  };
  const $ = (id) => document.getElementById(id);
  let records = loadRecords();
  let toastTimer;

  function uid() {
    return "fish-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function cleanRecord(raw) {
    const r = {};
    for (const key of FIELDS) r[key] = String(raw?.[key] ?? "").trim();
    r.id = String(raw?.id || uid());
    return r;
  }
  function loadRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map(cleanRecord) : [];
    } catch { return []; }
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      render();
    } catch {
      showToast("Не вдалося зберегти дані. Експортуй резервну копію.");
    }
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }
  function uniqueSorted(values) {
    return [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "uk"));
  }
  function fillSelect(select, values, placeholder, selected = "") {
    const list = uniqueSorted(values);
    select.innerHTML = `<option value="">${esc(placeholder)}</option>` +
      list.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if (list.includes(selected)) select.value = selected;
  }
  function setDatalist(id, values) {
    $(id).innerHTML = uniqueSorted(values).map(v => `<option value="${esc(v)}"></option>`).join("");
  }
  function getMaps() { return uniqueSorted(records.map(r => r.map)); }
  function getLocations(map = "") {
    return uniqueSorted(records.filter(r => !map || r.map === map).map(r => r.location));
  }
  function rebuildFilterOptions(keep = true) {
    const selected = keep ? {
      map: $("filterMap").value, location: $("filterLocation").value,
      bait: $("filterBait").value, time: $("filterTime").value, tackle: $("filterTackle").value
    } : {};
    fillSelect($("filterMap"), getMaps(), "Усі карти", selected.map);
    const map = $("filterMap").value;
    const locs = getLocations(map);
    fillSelect($("filterLocation"), locs, "Усі локації", selected.location);
    $("filterLocation").disabled = !map;
    fillSelect($("filterBait"), records.map(r => r.bait), "Усі наживки", selected.bait);
    fillSelect($("filterTime"), records.map(r => r.time), "Будь-який час", selected.time);
    fillSelect($("filterTackle"), records.map(r => r.tackle), "Усі снасті", selected.tackle);
    setDatalist("mapOptions", getMaps());
    setDatalist("locationOptions", getLocations($("fishMap").value.trim()));
    setDatalist("baitOptions", records.map(r => r.bait));
    setDatalist("tackleOptions", records.map(r => r.tackle));
  }
  function getFiltered() {
    const query = $("searchInput").value.trim().toLocaleLowerCase("uk");
    const map = $("filterMap").value;
    const location = $("filterLocation").value;
    const bait = $("filterBait").value;
    const time = $("filterTime").value;
    const tackle = $("filterTackle").value;
    return records.filter(r => {
      const haystack = [r.name, r.map, r.location, r.bait, r.time, r.tackle, r.depth, r.notes].join(" ").toLocaleLowerCase("uk");
      return (!query || haystack.includes(query)) &&
        (!map || r.map === map) && (!location || r.location === location) &&
        (!bait || r.bait === bait) && (!time || r.time === time) &&
        (!tackle || r.tackle === tackle);
    }).sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }
  function detail(icon, label, value) {
    return `<div class="detail-row"><span class="detail-icon">${icon}</span><span class="detail-label">${label}</span><span class="detail-value ${value ? "" : "empty"}">${esc(value || "Не вказано")}</span></div>`;
  }
  function card(r) {
    const note = r.notes ? `<div class="note-box"><div class="note-title">Примітка</div>${esc(r.notes)}</div>` : "";
    const tags = [r.time, r.tackle].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join("");
    return `<article class="fish-card">
      <div class="card-top"><div><h3 class="fish-name">${esc(r.name || "Без назви")}</h3><p class="map-label">🗺️ ${esc(r.map || "Карта не вказана")} · ${esc(r.location || "Локація не вказана")}</p></div>
      <div class="card-actions"><button class="icon-button" type="button" data-edit="${esc(r.id)}" aria-label="Редагувати ${esc(r.name)}" title="Редагувати">✎</button><button class="icon-button delete" type="button" data-delete="${esc(r.id)}" aria-label="Видалити ${esc(r.name)}" title="Видалити">×</button></div></div>
      <div class="detail-list">
        ${detail("🪱", "Наживка", r.bait)}
        ${detail("🎣", "Снасті", r.tackle)}
        ${detail("🌗", "Час", r.time)}
        ${detail("↕️", "Глибина", r.depth)}
      </div>${tags ? `<div class="tag-row">${tags}</div>` : ""}${note}
    </article>`;
  }
  function render() {
    rebuildFilterOptions(true);
    const filtered = getFiltered();
    $("records").innerHTML = filtered.map(card).join("");
    $("records").hidden = filtered.length === 0;
    $("emptyState").hidden = filtered.length !== 0;
    const noRecords = records.length === 0;
    $("emptyTitle").textContent = noRecords ? "Поки що записів немає" : "Нічого не знайдено";
    $("emptyCopy").textContent = noRecords
      ? "Додай першу рибу або імпортуй готовий JSON чи CSV-файл."
      : "Спробуй змінити фільтри або пошуковий запит.";
    $("emptyAdd").hidden = !noRecords;
    $("totalCount").textContent = records.length;
    $("mapCount").textContent = getMaps().length;
    $("locationCount").textContent = uniqueSorted(records.map(r => r.map + "||" + r.location).filter(x => x !== "||")).length;
    $("resultCount").textContent = `Показано ${filtered.length} з ${records.length} записів`;
  }
  function showToast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }
  function openForm(record = null) {
    $("fishForm").reset();
    $("recordId").value = record?.id || "";
    $("dialogTitle").textContent = record ? "Редагувати запис" : "Додати рибу";
    $("formEyebrow").textContent = record ? "РЕДАГУВАННЯ ЗАПИСУ" : "НОВИЙ ЗАПИС";
    for (const key of FIELDS) {
      const id = ({name:"fishName", map:"fishMap", location:"fishLocation", bait:"fishBait", time:"fishTime", tackle:"fishTackle", depth:"fishDepth", notes:"fishNotes"})[key];
      $(id).value = record?.[key] || "";
    }
    updateLocationSuggestions();
    $("fishDialog").showModal();
    $("fishName").focus();
  }
  function updateLocationSuggestions() {
    const map = $("fishMap").value.trim();
    setDatalist("locationOptions", getLocations(map));
    const locationInput = $("fishLocation");
    locationInput.placeholder = map ? "Обери або введи локацію" : "Спочатку обери карту";
    if (locationInput.value && map && records.some(r => r.location === locationInput.value && r.map !== map)) {
      // Keep the typed value; users may intentionally add a new location with the same name.
    }
  }
  function saveForm(event) {
    event.preventDefault();
    const record = cleanRecord({
      id: $("recordId").value || uid(),
      name: $("fishName").value, map: $("fishMap").value, location: $("fishLocation").value,
      bait: $("fishBait").value, time: $("fishTime").value, tackle: $("fishTackle").value,
      depth: $("fishDepth").value, notes: $("fishNotes").value
    });
    if (!record.name || !record.map || !record.location) {
      showToast("Заповни назву риби, карту та локацію.");
      return;
    }
    const idx = records.findIndex(r => r.id === record.id);
    if (idx >= 0) records[idx] = record;
    else records.push(record);
    persist();
    $("fishDialog").close();
    showToast(idx >= 0 ? "Запис оновлено" : "Рибу додано до бази");
  }
  function download(name, content, type) {
    const blob = new Blob(["\ufeff", content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function exportJson() {
    download("fishbase-backup.json", JSON.stringify(records, null, 2), "application/json;charset=utf-8");
    showToast("JSON-файл із базою завантажено");
  }
  function csvCell(value) {
    const s = String(value ?? "");
    return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv() {
    const headers = FIELDS.map(k => FIELD_LABELS[k]);
    const rows = records.map(r => FIELDS.map(k => csvCell(r[k])).join(","));
    download("fishbase-export.csv", [headers.join(","), ...rows].join("\r\n"), "text/csv;charset=utf-8");
    showToast("CSV-файл із базою завантажено");
  }
  function parseCsv(text) {
    // RFC4180-style parser; accepts commas, quoted values, and newlines inside quotes.
    const rows = []; let row = []; let cell = ""; let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else {
        if (ch === '"' && cell === "") quoted = true;
        else if (ch === ",") { row.push(cell); cell = ""; }
        else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
        else cell += ch;
      }
    }
    if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
    if (!rows.length) return [];
    const normalize = s => String(s).trim().toLocaleLowerCase("uk").replace(/\s+/g, " ");
    const aliases = {
      name: ["назва риби","name","fish","риба"], map: ["карта","map"],
      location: ["локація","локация","location","місце"], bait: ["наживка","bait"],
      time: ["час","time"], tackle: ["тип снасті","снасті","tackle","gear"],
      depth: ["глибина","depth"], notes: ["примітка","примечание","notes","note"]
    };
    const header = rows[0].map(normalize);
    const indexes = {};
    for (const key of FIELDS) indexes[key] = header.findIndex(h => aliases[key].includes(h));
    const hasHeader = indexes.name >= 0 && indexes.map >= 0;
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const keys = hasHeader ? FIELDS : FIELDS;
    return dataRows.filter(r => r.some(v => String(v).trim())).map(r => {
      const obj = {};
      keys.forEach((key, idx) => {
        const column = hasHeader ? indexes[key] : idx;
        obj[key] = column >= 0 ? (r[column] ?? "") : "";
      });
      return cleanRecord(obj);
    });
  }
  async function importFile(file) {
    if (!file) return;
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      let incoming;
      if (file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv")) incoming = parseCsv(text);
      else {
        const parsed = JSON.parse(text);
        incoming = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.records) ? parsed.records : null);
        if (!incoming) throw new Error("JSON має містити масив записів або поле records із масивом.");
        incoming = incoming.map(cleanRecord);
      }
      incoming = incoming.filter(r => r.name && r.map && r.location);
      if (!incoming.length) throw new Error("Не знайдено коректних записів. Перевір заголовки й обов'язкові поля.");
      const replace = confirm(`Знайдено записів: ${incoming.length}.\n\nOK — замінити поточну базу імпортованими записами.\nСкасувати — додати їх до поточної бази.`);
      if (replace) records = incoming;
      else {
        // Merge by all visible fields; retain existing IDs and avoid exact duplicates.
        const signature = r => FIELDS.map(k => r[k].trim().toLocaleLowerCase("uk")).join("\u001f");
        const known = new Set(records.map(signature));
        for (const r of incoming) if (!known.has(signature(r))) { records.push({...r, id: uid()}); known.add(signature(r)); }
      }
      persist();
      showToast(`Імпортовано записів: ${incoming.length}`);
    } catch (err) {
      alert("Не вдалося імпортувати файл.\n" + (err?.message || "Перевір формат файлу."));
    } finally { $("importFile").value = ""; }
  }

  $("addFish").addEventListener("click", () => openForm());
  $("addFishTop").addEventListener("click", () => openForm());
  $("emptyAdd").addEventListener("click", () => openForm());
  $("closeDialog").addEventListener("click", () => $("fishDialog").close());
  $("cancelDialog").addEventListener("click", () => $("fishDialog").close());
  $("fishForm").addEventListener("submit", saveForm);
  $("fishMap").addEventListener("input", updateLocationSuggestions);
  $("filterMap").addEventListener("change", () => {
    fillSelect($("filterLocation"), getLocations($("filterMap").value), "Усі локації");
    $("filterLocation").disabled = !$("filterMap").value;
    render();
  });
  ["searchInput", "filterLocation", "filterBait", "filterTime", "filterTackle"].forEach(id => $(id).addEventListener(id === "searchInput" ? "input" : "change", render));
  $("resetFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    ["filterMap", "filterLocation", "filterBait", "filterTime", "filterTackle"].forEach(id => $(id).value = "");
    $("filterLocation").disabled = true;
    render();
  });
  $("records").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");
    if (edit) {
      const record = records.find(r => r.id === edit.dataset.edit);
      if (record) openForm(record);
    }
    if (del) {
      const record = records.find(r => r.id === del.dataset.delete);
      if (record && confirm(`Видалити запис «${record.name}»?`)) {
        records = records.filter(r => r.id !== record.id);
        persist(); showToast("Запис видалено");
      }
    }
  });
  $("exportJsonTop").addEventListener("click", exportJson);
  $("exportCsv").addEventListener("click", exportCsv);
  $("importFile").addEventListener("change", e => importFile(e.target.files?.[0]));
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) { records = loadRecords(); render(); showToast("Дані оновлено в іншій вкладці цього браузера"); }
  });

  // Optional starter records are deliberately not inserted; the base starts empty.
  render();
})();