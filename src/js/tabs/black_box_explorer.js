'use strict';

TABS.black_box_explorer = {};
TABS.black_box_explorer.initialize = function (callback) {
    var self = this;

    if (GUI.active_tab != 'black_box_explorer') {
        GUI.active_tab = 'black_box_explorer';
    }

    $('#content').load("./tabs/black_box_explorer.html", function () {
        //i18n.localizePage();
        GUI.content_ready(callback);
    });
};

TABS.black_box_explorer.cleanup = function (callback) {
    if (callback) callback();
};
