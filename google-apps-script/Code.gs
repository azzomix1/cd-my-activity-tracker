const SPREADSHEET_ID = '1PrNCGIfQWE5hRR34Aobd1rDNh04NmqWO5i7eLu_Mn9Y';
const SHEET_NAME = 'База';
const HEADER_ROW = ['ID', 'Дата мероприятия', 'Время мероприятия', 'Название', 'Участник', 'Объекты', 'Тип'];
// Часовой пояс таблицы — Новосибирск (UTC+7).
// Все даты и времена форматируются в этом поясе, чтобы все пользователи
// видели одинаковое время независимо от часового пояса их браузера.
const TIMEZONE = 'Asia/Novosibirsk';

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'list';

    if (action !== 'list') {
      return jsonResponse({ success: false, error: 'Unsupported action.' });
    }

    return jsonResponse({ success: true, items: listActivities_() });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = payload.action;

    if (action === 'create') {
      return jsonResponse({ success: true, item: createActivity_(payload.activity || {}) });
    }

    if (action === 'update') {
      return jsonResponse({ success: true, item: updateActivity_(payload.activity || {}) });
    }

    if (action === 'delete') {
      deleteActivity_(payload.id);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: 'Unsupported action.' });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function listActivities_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, 7)
    .getValues()
    .filter(function(row) {
      return row[0];
    })
    .map(function(row) {
      return mapRowToActivity_(row);
    });
}

function createActivity_(activity) {
  const sheet = getSheet_();
  const normalized = normalizeActivity_(activity);

  if (!normalized.id) {
    normalized.id = Utilities.getUuid();
  }

  const row = mapActivityToRow_(normalized);
  // Prevent Google Sheets from auto-converting time/date strings to Date objects
  // by prefixing with apostrophe (forces text format)
  row[1] = "'" + row[1];  // date
  row[2] = "'" + row[2];  // time

  sheet.appendRow(row);
  return normalized;
}

function updateActivity_(activity) {
  const sheet = getSheet_();
  const normalized = normalizeActivity_(activity);

  if (!normalized.id) {
    throw new Error('Activity ID is required for update.');
  }

  const row = mapActivityToRow_(normalized);
  // Prevent Google Sheets from auto-converting time/date strings to Date objects
  // by prefixing with apostrophe (forces text format)
  row[1] = "'" + row[1];  // date
  row[2] = "'" + row[2];  // time

  const rowIndex = findRowById_(sheet, normalized.id);
  sheet.getRange(rowIndex, 1, 1, 7).setValues([row]);
  return normalized;
}

function deleteActivity_(id) {
  const sheet = getSheet_();
  const rowIndex = findRowById_(sheet, id);
  sheet.deleteRow(rowIndex);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];

  if (!sheet) {
    throw new Error('Sheet not found.');
  }

  ensureHeader_(sheet);
  return sheet;
}

function ensureHeader_(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADER_ROW.length);
  const currentHeader = headerRange.getValues()[0];
  const isEmpty = currentHeader.every(function(cell) {
    return !cell;
  });

  if (isEmpty) {
    headerRange.setValues([HEADER_ROW]);
  }
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('Activity not found.');
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (var index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(id)) {
      return index + 2;
    }
  }

  throw new Error('Activity not found.');
}

function normalizeActivity_(activity) {
  return {
    id: activity.id ? String(activity.id) : '',
    date: activity.date ? String(activity.date) : '',
    time: activity.time ? String(activity.time) : '',
    name: activity.name ? String(activity.name) : '',
    person: activity.person ? String(activity.person) : '',
    objects: activity.objects ? String(activity.objects) : '',
    eventType: normalizeEventType_(activity.eventType),
  };
}

function normalizeEventType_(value) {
  const normalized = value ? String(value).toLowerCase() : '';
  return normalized === 'external' || normalized === 'внешнее' ? 'внешнее' : 'внутреннее';
}

function formatDateCell_(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, TIMEZONE, 'dd.MM.yyyy');
  }
  var str = String(value).trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) return str;
  return str;
}

function formatTimeCell_(value) {
  if (!value) return '';
  if (value instanceof Date) {
    // Extract hours and minutes directly from Date object using script timezone
    // (which should match the spreadsheet timezone for correct time values)
    var h = value.getHours();
    var m = value.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  var str = String(value).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) return str.slice(0, 5);
  return str;
}

function mapRowToActivity_(row) {
  return {
    id: String(row[0] || ''),
    date: formatDateCell_(row[1]),
    time: formatTimeCell_(row[2]),
    name: String(row[3] || ''),
    person: String(row[4] || ''),
    objects: String(row[5] || ''),
    eventType: String(row[6] || '').toLowerCase() === 'внешнее' ? 'external' : 'internal',
  };
}

function mapActivityToRow_(activity) {
  return [
    activity.id,
    activity.date,
    activity.time,
    activity.name,
    activity.person,
    activity.objects,
    activity.eventType,
  ];
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}