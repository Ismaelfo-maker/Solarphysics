/* =========================================================================
   storage.js — Persistencia con localStorage
   ========================================================================= */
window.SP = window.SP || {};
(function (SP) {
  'use strict';
  const KEY = 'solarphysics.v1';

  SP.Store = {
    _data: null,

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        this._data = raw ? JSON.parse(raw) : {};
      } catch (e) { this._data = {}; }
      this._data.completedMissions = this._data.completedMissions || [];
      this._data.experiments = this._data.experiments || [];
      this._data.visited = this._data.visited || [];
      this._data.flags = this._data.flags || [];
      this._data.settings = this._data.settings || {};
      return this._data;
    },

    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this._data)); } catch (e) {}
    },

    reset() {
      this._data = null;
      try { localStorage.removeItem(KEY); } catch (e) {}
      this.load();
    },

    completeMission(id) {
      if (!this._data.completedMissions.includes(id)) {
        this._data.completedMissions.push(id);
        this.save();
        return true;
      }
      return false;
    },

    isMissionComplete(id) { return this._data.completedMissions.includes(id); },

    addExperiment(exp) {
      this._data.experiments.unshift(exp);
      if (this._data.experiments.length > 60) this._data.experiments.pop();
      this.save();
    },

    markVisited(id) {
      if (!this._data.visited.includes(id)) {
        this._data.visited.push(id);
        this.save();
      }
    },

    setFlag(f) {
      if (!this._data.flags.includes(f)) {
        this._data.flags.push(f);
        this.save();
      }
    },

    hasFlag(f) { return this._data.flags.includes(f); }
  };
})(window.SP);
