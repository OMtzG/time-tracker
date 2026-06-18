(function () {
  'use strict';

  var ENTRIES_KEY = 'time_entries';
  var CONFIG_KEY = 'time_config';

  var DEFAULT_CONFIG = {
    sanction_rate_eur: 3.0,
    weekly_targets: {
      'Introspección': 2,
      'Proyecto': 8,
      'Curso': 5
    },
    categories: ['Introspección', 'Proyecto', 'Curso']
  };

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  var Storage = {
    getEntries: function () {
      try {
        var raw = localStorage.getItem(ENTRIES_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error('Storage.getEntries error:', e);
        return [];
      }
    },

    saveEntry: function (entry) {
      try {
        var entries = this.getEntries();
        var idx = entries.findIndex(function (e) { return e.id === entry.id; });
        if (idx >= 0) {
          entries[idx] = entry;
        } else {
          entries.push(entry);
        }
        localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
        return entry;
      } catch (e) {
        console.error('Storage.saveEntry error:', e);
        return null;
      }
    },

    deleteEntry: function (id) {
      try {
        var entries = this.getEntries().filter(function (e) { return e.id !== id; });
        localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
        return true;
      } catch (e) {
        console.error('Storage.deleteEntry error:', e);
        return false;
      }
    },

    getConfig: function () {
      try {
        var raw = localStorage.getItem(CONFIG_KEY);
        if (!raw) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        var config = JSON.parse(raw);
        if (!config.categories) config.categories = DEFAULT_CONFIG.categories.slice();
        if (!config.weekly_targets) config.weekly_targets = JSON.parse(JSON.stringify(DEFAULT_CONFIG.weekly_targets));
        if (config.sanction_rate_eur === undefined) config.sanction_rate_eur = DEFAULT_CONFIG.sanction_rate_eur;
        return config;
      } catch (e) {
        console.error('Storage.getConfig error:', e);
        return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      }
    },

    saveConfig: function (config) {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
        return config;
      } catch (e) {
        console.error('Storage.saveConfig error:', e);
        return null;
      }
    },

    getEntriesByDate: function (date) {
      return this.getEntries().filter(function (e) { return e.date === date; });
    },

    getEntriesByRange: function (startDate, endDate) {
      return this.getEntries().filter(function (e) {
        return e.date >= startDate && e.date <= endDate;
      });
    },

    generateId: generateId
  };

  var Categories = {
    getAll: function () {
      return Storage.getConfig().categories || [];
    },

    add: function (name) {
      if (!name || typeof name !== 'string') return false;
      name = name.trim();
      if (!name) return false;
      var config = Storage.getConfig();
      if (config.categories.indexOf(name) >= 0) return false;
      config.categories.push(name);
      Storage.saveConfig(config);
      return true;
    },

    remove: function (name) {
      if (!name) return false;
      var thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      var cutoff = thirtyDaysAgo.toISOString().slice(0, 10);
      var recentEntries = Storage.getEntries().filter(function (e) {
        return e.category === name && e.date >= cutoff;
      });
      if (recentEntries.length > 0) return false;
      var config = Storage.getConfig();
      config.categories = config.categories.filter(function (c) { return c !== name; });
      if (config.weekly_targets && config.weekly_targets[name] !== undefined) {
        delete config.weekly_targets[name];
      }
      Storage.saveConfig(config);
      return true;
    }
  };

  window.Storage = Storage;
  window.Categories = Categories;
})();
