/* ============================================
   Content loader
   Reads the .md files in /content and renders them
   into the page. See content/*.md for the editable
   text and the format each file expects.
   ============================================ */

(function () {
  "use strict";

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Minimal inline markdown: **bold**, *italic*, [text](url)
  function inline(str) {
    if (!str) return "";
    var html = escapeHtml(str);
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, text, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener">' + text + "</a>";
    });
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return html;
  }

  function stripComments(text) {
    return text.replace(/<!--[\s\S]*?-->/g, "");
  }

  // "### Title" + "- field: value" lines, entries separated by a "---" line
  function parseEntries(text) {
    var body = stripComments(text).trim();
    if (!body) return [];
    return body.split(/^\s*---\s*$/m).map(function (block) {
      var lines = block.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      var entry = { title: "", fields: {} };
      lines.forEach(function (line) {
        var headingMatch = line.match(/^#{1,6}\s+(.*)$/);
        var fieldMatch = line.match(/^-\s*([a-zA-Z]+)\s*:\s*(.*)$/);
        if (headingMatch) {
          entry.title = headingMatch[1].trim();
        } else if (fieldMatch) {
          var key = fieldMatch[1].toLowerCase();
          if (!entry.fields[key]) entry.fields[key] = [];
          entry.fields[key].push(fieldMatch[2].trim());
        }
      });
      return entry;
    }).filter(function (e) { return e.title; });
  }

  // "- key: value" lines, no headings, order preserved
  function parseKeyList(text) {
    var body = stripComments(text).trim();
    if (!body) return [];
    var out = [];
    body.split("\n").forEach(function (line) {
      var m = line.trim().match(/^-\s*([^:]+):\s*(.*)$/);
      if (m) out.push({ key: m[1].trim(), value: m[2].trim() });
    });
    return out;
  }

  function parseMarkdown(text) {
    var body = stripComments(text).trim();
    if (!body) return "";
    return body.split(/\n\s*\n/).map(function (p) {
      return "<p>" + inline(p.replace(/\n/g, " ").trim()) + "</p>";
    }).join("");
  }

  function parseLinks(values) {
    return (values || []).map(function (v) {
      var parts = v.split("|");
      return { label: (parts[0] || "").trim(), url: (parts[1] || "").trim() };
    }).filter(function (l) { return l.label && l.url; });
  }

  var renderers = {
    education: renderTimelineEntries,
    experience: renderTimelineEntries,

    projects: function (text) {
      var entries = parseEntries(text);
      return entries.map(function (e) {
        var period = e.fields.period ? e.fields.period[0] : "";
        var details = (e.fields.detail || []).map(inline).join(" ");
        var links = parseLinks(e.fields.link).map(function (l) {
          return '<a href="' + l.url + '" target="_blank" rel="noopener">' + inline(l.label) + "</a>";
        }).join(" / ");
        return (
          '<div class="card project-card">' +
          "<strong>" + inline(e.title) + "</strong>" +
          (period ? " (" + inline(period) + ")" : "") +
          (details ? " — " + details : "") +
          (links ? '<div class="links">' + links + "</div>" : "") +
          "</div>"
        );
      }).join("");
    },

    publications: function (text) {
      var entries = parseEntries(text);
      if (!entries.length) return "";
      var items = entries.map(function (e) {
        var authors = e.fields.authors ? inline(e.fields.authors[0]) : "";
        var venue = e.fields.venue ? inline(e.fields.venue[0]) : "";
        var links = parseLinks(e.fields.link).map(function (l) {
          return '<a href="' + l.url + '" target="_blank" rel="noopener">' + inline(l.label) + "</a>";
        }).join(" / ");
        return (
          "<li><div class=\"pub-row\"><div class=\"pub-content\">" +
          '<div class="title">' + inline(e.title) + "</div>" +
          (authors ? '<div class="author">' + authors + "</div>" : "") +
          (venue ? '<div class="periodical"><em><strong>' + venue + "</strong></em></div>" : "") +
          (links ? '<div class="links">' + links + "</div>" : "") +
          "</div></div></li>"
        );
      }).join("");
      return '<div class="publications"><ol class="bibliography">' + items + "</ol></div>";
    },

    awards: function (text) {
      var entries = parseEntries(text);
      if (!entries.length) return "";
      var items = entries.map(function (e) {
        var icon = e.fields.icon ? e.fields.icon[0] : "🏅";
        var detail = e.fields.detail ? inline(e.fields.detail[0]) : "";
        return (
          '<div class="award-item"><span class="award-icon">' + icon + "</span>" +
          '<div class="award-text"><strong>' + inline(e.title) + "</strong>" +
          (detail ? " — " + detail : "") +
          "</div></div>"
        );
      }).join("");
      return '<div class="awards-grid">' + items + "</div>";
    },

    skills: function (text) {
      return parseKeyList(text).map(function (row) {
        return "<p><strong>" + escapeHtml(row.key) + ":</strong> " + inline(row.value) + "</p>";
      }).join("");
    },

    news: function (text) {
      var body = stripComments(text).trim();
      if (!body) return "";
      var items = body.split("\n").map(function (line) {
        var m = line.trim().match(/^-\s*([^:]+):\s*(.*)$/);
        if (!m) return null;
        var dateStr = m[1].trim();
        var dm = dateStr.match(/(\d{4})\D?(\d{1,2})?/);
        var sortKey = dm ? parseInt(dm[1], 10) * 100 + (dm[2] ? parseInt(dm[2], 10) : 0) : 0;
        return { date: dateStr, text: m[2].trim(), sortKey: sortKey };
      }).filter(Boolean);

      items.sort(function (a, b) { return b.sortKey - a.sortKey; });

      return items.map(function (item) {
        return (
          '<div class="timeline-item news-item">' +
          '<p class="exp-period news-date">' + escapeHtml(item.date) + "</p>" +
          '<p class="exp-detail news-text">' + inline(item.text) + "</p>" +
          "</div>"
        );
      }).join("");
    },

    markdown: parseMarkdown
  };

  function renderTimelineEntries(text) {
    var entries = parseEntries(text);
    return entries.map(function (e) {
      var period = e.fields.period ? e.fields.period[0] : "";
      var details = (e.fields.detail || []).map(function (d) {
        return '<p class="exp-detail">' + inline(d) + "</p>";
      }).join("");
      return (
        '<div class="card timeline-item"><div class="experience-item">' +
        '<img src="assets/img/institution.svg" alt="" class="institution-logo">' +
        '<div class="experience-content">' +
        '<p class="exp-title"><strong>' + inline(e.title) + "</strong></p>" +
        details +
        (period ? '<p class="exp-period">' + inline(period) + "</p>" : "") +
        "</div></div></div>"
      );
    }).join("");
  }

  var CONTACT_LINKS = [
    { key: "email", icon: "fa-solid fa-envelope", href: function (v) { return "mailto:" + v; } },
    { key: "github", icon: "fa-brands fa-github", href: function (v) { return v; } },
    { key: "linkedin", icon: "fa-brands fa-linkedin", href: function (v) { return v; } },
    { key: "scholar", icon: "ai ai-google-scholar", href: function (v) { return v; } },
    { key: "blog", icon: "fa-solid fa-rss", href: function (v) { return v; } }
  ];

  function renderContact(text) {
    var fields = {};
    parseKeyList(text).forEach(function (row) {
      fields[row.key.toLowerCase()] = row.value;
    });

    var nameEl = document.querySelector("[data-field=\"name\"]");
    var emailEl = document.querySelector("[data-field=\"email\"]");
    var avatarEl = document.querySelector("[data-field=\"avatar\"]");
    var socialEl = document.querySelector("[data-field=\"social\"]");

    if (nameEl && fields.name) nameEl.textContent = fields.name;
    if (emailEl && fields.email) emailEl.textContent = fields.email;
    if (avatarEl && fields.avatar) {
      avatarEl.src = fields.avatar;
      if (fields.name) avatarEl.alt = fields.name;
    }
    if (socialEl) {
      socialEl.innerHTML = CONTACT_LINKS.filter(function (link) {
        return fields[link.key];
      }).map(function (link) {
        return (
          '<a href="' + link.href(fields[link.key]) + '" title="' + link.key + '">' +
          '<i class="' + link.icon + '"></i></a>'
        );
      }).join("");
    }
  }

  function loadSection(el) {
    var url = el.getAttribute("data-content");
    var format = el.getAttribute("data-format");
    var renderer = renderers[format];
    if (!url || !renderer) return;
    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      })
      .then(function (text) {
        el.innerHTML = renderer(text);
      })
      .catch(function () {
        el.innerHTML = '<p style="opacity:.6">Could not load ' + url + ". If you're opening this file directly from disk, run a local server (e.g. <code>python3 -m http.server</code>) or view it on GitHub Pages.</p>";
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-content]").forEach(loadSection);

    var contactEl = document.querySelector("[data-contact]");
    if (contactEl) {
      fetch(contactEl.getAttribute("data-contact"), { cache: "no-store" })
        .then(function (res) { return res.text(); })
        .then(renderContact)
        .catch(function () {});
    }
  });
})();
