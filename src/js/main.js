'use strict';

openNewWindowsInExternalBrowser();

//Asynchronous configuration to be done.
//When finish the startProcess() function must be called
$(document).ready(function () {
    i18n.init(function() {
        startProcess();
        initializeSerialBackend();
    });
});

//Process to execute to real start the app
function startProcess() {

    // translate to user-selected language
    i18n.localizePage();

    // alternative - window.navigator.appVersion.match(/Chrome\/([0-9.]*)/)[1];
    GUI.log(i18n.getMessage('infoVersions',{operatingSystem: GUI.operating_system, 
                                            chromeVersion: window.navigator.appVersion.replace(/.*Chrome\/([0-9.]*).*/, "$1"), 
                                            configuratorVersion: getManifestVersion()}));

    $('#logo .version').text(getManifestVersion());
    updateStatusBarVersion();
    updateTopBarVersion();

    // notification messages for various operating systems
    switch (GUI.operating_system) {
        case 'Windows':
            break;
        case 'MacOS':
            // var main_chromium_version = window.navigator.appVersion.replace(/.*Chrome\/([0-9.]*).*/,"$1").split('.')[0];
            break;
        case 'ChromeOS':
            break;
        case 'Linux':
            break;
        case 'UNIX':
            break;
    }

    if (GUI.operating_system !== 'ChromeOS') {
        checkForConfiguratorUpdates();
    }

    chrome.storage.local.get('logopen', function (result) {
        if (result.logopen) {
            $("#showlog").trigger('click');
        }
    });

    // log webgl capability
    // it would seem the webgl "enabling" through advanced settings will be ignored in the future
    // and webgl will be supported if gpu supports it by default (canary 40.0.2175.0), keep an eye on this one
    var canvas = document.createElement('canvas');

    // log library versions in console to make version tracking easier
    console.log('Libraries: jQuery - ' + $.fn.jquery + ', d3 - ' + d3.version + ', three.js - ' + THREE.REVISION);

    // Tabs
    var ui_tabs = $('#tabs > ul');
    $('a', ui_tabs).click(function () {
        if ($(this).parent().hasClass('active') == false && !GUI.tab_switch_in_progress) { // only initialize when the tab isn't already active
            var self = this,
                tabClass = $(self).parent().prop('class');

            var tabRequiresConnection = $(self).parent().hasClass('mode-connected');

            var tab = tabClass.substring(4);
            var tabName = $(self).text();

            if (tabRequiresConnection && !CONFIGURATOR.connectionValid) {
                GUI.log(i18n.getMessage('tabSwitchConnectionRequired'));
                return;
            }

            if (GUI.connect_lock) { // tab switching disabled while operation is in progress
                GUI.log(i18n.getMessage('tabSwitchWaitForOperation'));
                return;
            }

            if (GUI.allowedTabs.indexOf(tab) < 0) {
                GUI.log(i18n.getMessage('tabSwitchUpgradeRequired', [tabName]));
                return;
            }

            GUI.tab_switch_in_progress = true;

            GUI.tab_switch_cleanup(function () {
                // disable previously active tab highlight
                $('li', ui_tabs).removeClass('active');

                // Highlight selected tab
                $(self).parent().addClass('active');

                // detach listeners and remove element data
                var content = $('#content');
                content.empty();

                // display loading screen
                $('#cache .data-loading').clone().appendTo(content);

                function content_ready() {
                    GUI.tab_switch_in_progress = false;
                }

                switch (tab) {
                    case 'landing':
                        TABS.landing.initialize(content_ready);
                        break;
                    case 'firmware_flasher':
                        TABS.firmware_flasher.initialize(content_ready);
                        break;
                    case 'help':
                        TABS.help.initialize(content_ready);
                        break;
                    case 'auxiliary':
                        TABS.auxiliary.initialize(content_ready);
                        break;
                    case 'adjustments':
                        TABS.adjustments.initialize(content_ready);
                        break;
                    case 'ports':
                        TABS.ports.initialize(content_ready);
                        break;
                    case 'led_strip':
                        TABS.led_strip.initialize(content_ready);
                        break;
                    case 'failsafe':
                        TABS.failsafe.initialize(content_ready);
                        break;
                    case 'transponder':
                        TABS.transponder.initialize(content_ready);
                        break;
                    case 'osd':
                        TABS.osd.initialize(content_ready);
                        break;
                    case 'power':
                        TABS.power.initialize(content_ready);
                        break;
                    case 'setup':
                        TABS.setup.initialize(content_ready);
                        break;
                    case 'setup_osd':
                        TABS.setup_osd.initialize(content_ready);
                        break;

                    case 'configuration':
                        TABS.configuration.initialize(content_ready);
                        break;
                    case 'pid_tuning':
                        TABS.pid_tuning.initialize(content_ready);
                        break;
                    case 'receiver':
                        TABS.receiver.initialize(content_ready);
                        break;
                    case 'servos':
                        TABS.servos.initialize(content_ready);
                        break;
                    case 'gps':
                        TABS.gps.initialize(content_ready);
                        break;
                    case 'motors':
                        TABS.motors.initialize(content_ready);
                        break;
                    case 'sensors':
                        TABS.sensors.initialize(content_ready);
                        break;
                    case 'logging':
                        TABS.logging.initialize(content_ready);
                        break;
                    case 'onboard_logging':
                        TABS.onboard_logging.initialize(content_ready);
                        break;
                    case 'cli':
                        TABS.cli.initialize(content_ready);
                        break;

                    default:
                        console.log('Tab not found:' + tab);
                }
            });
        }
    });

    $('#tabs ul.mode-disconnected li a:first').click();

    // options
    $('a#options').click(function () {
        var el = $(this);

        if (!el.hasClass('active')) {
            el.addClass('active');
            el.after('<div id="options-window"></div>');

            $('div#options-window').load('./tabs/options.html', function () {
                // translate to user-selected language
                i18n.localizePage();

                chrome.storage.local.get('permanentExpertMode', function (result) {
                    if (result.permanentExpertMode) {
                        $('div.permanentExpertMode input').prop('checked', true);
                    }

                    $('div.permanentExpertMode input').change(function () {
                        var checked = $(this).is(':checked');

                        chrome.storage.local.set({'permanentExpertMode': checked});

                        $('input[name="expertModeCheckbox"]').prop('checked', checked).change();
                        if (FEATURE_CONFIG) {
                            updateTabList(FEATURE_CONFIG.features);
                        }

                    }).change();
                });

                if (GUI.operating_system !== 'ChromeOS') {
                    chrome.storage.local.get('checkForConfiguratorUnstableVersions', function (result) {
                        if (result.checkForConfiguratorUnstableVersions) {
                            $('div.checkForConfiguratorUnstableVersions input').prop('checked', true);
                        }

                        $('div.checkForConfiguratorUnstableVersions input').change(function () {
                            var checked = $(this).is(':checked');

                            chrome.storage.local.set({'checkForConfiguratorUnstableVersions': checked});

                            checkForConfiguratorUpdates();
                        });
                    });
                } else {
                    $('div.checkForConfiguratorUnstableVersions').hide();
                }

                chrome.storage.local.get('userLanguageSelect', function (result) {

                    var userLanguage_e = $('div.userLanguage select');
                    var languagesAvailables = i18n.getLanguagesAvailables();
                    userLanguage_e.append('<option value="DEFAULT">' + i18n.getMessage('language_default') + '</option>');
                    userLanguage_e.append('<option disabled>------</option>');
                    languagesAvailables.forEach(function(element) {
                        var languageName = i18n.getMessage('language_' + element);
                        userLanguage_e.append('<option value="' + element + '">' + languageName + '</option>');
                    });

                    if (result.userLanguageSelect) {
                        userLanguage_e.val(result.userLanguageSelect);
                    }

                    userLanguage_e.change(function () {
                        var languageSelected = $(this).val();

                        // Select the new language, a restart is required
                        chrome.storage.local.set({'userLanguageSelect': languageSelected});
                    });
                });

                function close_and_cleanup(e) {
                    if (e.type == 'click' && !$.contains($('div#options-window')[0], e.target) || e.type == 'keyup' && e.keyCode == 27) {
                        $(document).unbind('click keyup', close_and_cleanup);

                        $('div#options-window').slideUp(250, function () {
                            el.removeClass('active');
                            $(this).empty().remove();
                        });
                    }
                }

                $(document).bind('click keyup', close_and_cleanup);

                $(this).slideDown(250);
            });
        }
    });

    // listen to all input change events and adjust the value within limits if necessary
    $("#content").on('focus', 'input[type="number"]', function () {
        var element = $(this),
            val = element.val();

        if (!isNaN(val)) {
            element.data('previousValue', parseFloat(val));
        }
    });

    $("#content").on('keydown', 'input[type="number"]', function (e) {
        // whitelist all that we need for numeric control
        var whitelist = [
            96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, // numpad and standard number keypad
            109, 189, // minus on numpad and in standard keyboard
            8, 46, 9, // backspace, delete, tab
            190, 110, // decimal point
            37, 38, 39, 40, 13 // arrows and enter
        ];

        if (whitelist.indexOf(e.keyCode) == -1) {
            e.preventDefault();
        }
    });

    $("#content").on('change', 'input[type="number"]', function () {
        var element = $(this),
            min = parseFloat(element.prop('min')),
            max = parseFloat(element.prop('max')),
            step = parseFloat(element.prop('step')),
            val = parseFloat(element.val()),
            decimal_places;

        // only adjust minimal end if bound is set
        if (element.prop('min')) {
            if (val < min) {
                element.val(min);
                val = min;
            }
        }

        // only adjust maximal end if bound is set
        if (element.prop('max')) {
            if (val > max) {
                element.val(max);
                val = max;
            }
        }

        // if entered value is illegal use previous value instead
        if (isNaN(val)) {
            element.val(element.data('previousValue'));
            val = element.data('previousValue');
        }

        // if step is not set or step is int and value is float use previous value instead
        if (isNaN(step) || step % 1 === 0) {
            if (val % 1 !== 0) {
                element.val(element.data('previousValue'));
                val = element.data('previousValue');
            }
        }

        // if step is set and is float and value is int, convert to float, keep decimal places in float according to step *experimental*
        if (!isNaN(step) && step % 1 !== 0) {
            decimal_places = String(step).split('.')[1].length;

            if (val % 1 === 0) {
                element.val(val.toFixed(decimal_places));
            } else if (String(val).split('.')[1].length != decimal_places) {
                element.val(val.toFixed(decimal_places));
            }
        }
    });

    $("#showlog").on('click', function () {
        var state = $(this).data('state');
        if (state) {
            $("#log").animate({height: 27}, 200, function () {
                var command_log = $('div#log');
                command_log.scrollTop($('div.wrapper', command_log).height());
            });
            $("#log").removeClass('active');
            $("#content").removeClass('logopen');
            $(".tab_container").removeClass('logopen');
            $("#scrollicon").removeClass('active');
            chrome.storage.local.set({'logopen': false});

            state = false;
        } else {
            $("#log").animate({height: 111}, 200);
            $("#log").addClass('active');
            $("#content").addClass('logopen');
            $(".tab_container").addClass('logopen');
            $("#scrollicon").addClass('active');
            chrome.storage.local.set({'logopen': true});

            state = true;
        }
        $(this).text(state ? i18n.getMessage('logActionHide') : i18n.getMessage('logActionShow'));
        $(this).data('state', state);
    });

    chrome.storage.local.get('permanentExpertMode', function (result) {
        if (result.permanentExpertMode) {
            $('input[name="expertModeCheckbox"]').prop('checked', true);
        }

        $('input[name="expertModeCheckbox"]').change(function () {
            if (FEATURE_CONFIG) {
                updateTabList(FEATURE_CONFIG.features);
            }
        }).change();
    });
};

function checkForConfiguratorUpdates() {
    var releaseChecker = new ReleaseChecker('configurator', 'https://api.github.com/repos/butterflight/butterflight-configurator/releases');

    releaseChecker.loadReleaseData(notifyOutdatedVersion);
}

function notifyOutdatedVersion(releaseData) {
    chrome.storage.local.get('checkForConfiguratorUnstableVersions', function (result) {
        var showUnstableReleases = false;
        if (result.checkForConfiguratorUnstableVersions) {
            showUnstableReleases = true;
        }
         var versions = releaseData.filter(function (version) {
             var semVerVersion = semver.parse(version.tag_name);
             if (semVerVersion && (showUnstableReleases || semVerVersion.prerelease.length === 0)) {
                 return version;
             }
         }).sort(function (v1, v2) {
            try {
                return semver.compare(v2.tag_name, v1.tag_name);
            } catch (e) {
                return false;
            }
        });

        if (versions.length > 0 && semver.lt(getManifestVersion(), versions[0].tag_name)) {
            GUI.log(i18n.getMessage('configuratorUpdateNotice', [versions[0].tag_name, versions[0].html_url]));

            var dialog = $('.dialogConfiguratorUpdate')[0];

            $('.dialogConfiguratorUpdate-content').html(i18n.getMessage('configuratorUpdateNotice', [versions[0].tag_name, versions[0].html_url]));

            $('.dialogConfiguratorUpdate-closebtn').click(function() {
                dialog.close();
            });

            $('.dialogConfiguratorUpdate-websitebtn').click(function() {
                dialog.close();

                window.open(versions[0].html_url, '_blank');
            });

            dialog.showModal();
        }
    });
}

function update_packet_error(caller) {
    $('span.packet-error').html(caller.packet_error);
}

function microtime() {
    var now = new Date().getTime() / 1000;

    return now;
}

function millitime() {
    var now = new Date().getTime();

    return now;
}

var DEGREE_TO_RADIAN_RATIO = Math.PI / 180;

function degToRad(degrees) {
    return degrees * DEGREE_TO_RADIAN_RATIO;
}

function bytesToSize(bytes) {
    if (bytes < 1024) {
        bytes = bytes + ' Bytes';
    } else if (bytes < 1048576) {
        bytes = (bytes / 1024).toFixed(3) + ' KB';
    } else if (bytes < 1073741824) {
        bytes = (bytes / 1048576).toFixed(3) + ' MB';
    } else {
        bytes = (bytes / 1073741824).toFixed(3) + ' GB';
    }

    return bytes;
}

function isExpertModeEnabled() {
    return $('input[name="expertModeCheckbox"]').is(':checked');
}

function updateTabList(features) {
    if (features.isEnabled('GPS') && isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_gps').show();
    } else {
        $('#tabs ul.mode-connected li.tab_gps').hide();
    }

    if (isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_failsafe').show();
    } else {
        $('#tabs ul.mode-connected li.tab_failsafe').hide();
    }

    if (isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_adjustments').show();
    } else {
        $('#tabs ul.mode-connected li.tab_adjustments').hide();
    }

    if (isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_servos').show();
    } else {
        $('#tabs ul.mode-connected li.tab_servos').hide();
    }

    if (features.isEnabled('LED_STRIP')) {
        $('#tabs ul.mode-connected li.tab_led_strip').show();
    } else {
        $('#tabs ul.mode-connected li.tab_led_strip').hide();
    }

    if (isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_sensors').show();
    } else {
        $('#tabs ul.mode-connected li.tab_sensors').hide();
    }

    if (isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_logging').show();
    } else {
        $('#tabs ul.mode-connected li.tab_logging').hide();
    }

    if (features.isEnabled('TRANSPONDER')) {
        $('#tabs ul.mode-connected li.tab_transponder').show();
    } else {
        $('#tabs ul.mode-connected li.tab_transponder').hide();
    }

    if (features.isEnabled('OSD')) {
        $('#tabs ul.mode-connected li.tab_osd').show();
    } else {
        $('#tabs ul.mode-connected li.tab_osd').hide();
    }

    if (semver.gte(CONFIG.apiVersion, "1.36.0")) {
        $('#tabs ul.mode-connected li.tab_power').show();
    } else {
        $('#tabs ul.mode-connected li.tab_power').hide();
    }
}

function zeroPad(value, width) {
    value = "" + value;

    while (value.length < width) {
        value = "0" + value;
    }

    return value;
}

function generateFilename(prefix, suffix) {
    var date = new Date();
    var filename = prefix;

    if (CONFIG) {
        if (CONFIG.flightControllerIdentifier) {
            filename = CONFIG.flightControllerIdentifier + '_' + filename;
        }
        if(CONFIG.name && CONFIG.name.trim() !== '') {
            filename = filename + '_' + CONFIG.name.trim().replace(' ', '_');
        }
    }

    filename = filename + '_' + date.getFullYear()
        + zeroPad(date.getMonth() + 1, 2)
        + zeroPad(date.getDate(), 2)
        + '_' + zeroPad(date.getHours(), 2)
        + zeroPad(date.getMinutes(), 2)
        + zeroPad(date.getSeconds(), 2);

    return filename + '.' + suffix;
}

function getFirmwareVersion(firmwareVersion, firmwareId, hardwareId) {
    var versionText = '';

    if (firmwareVersion) {
        versionText += i18n.getMessage('versionLabelFirmware') + ': ' + firmwareId + ' ' + firmwareVersion;

        if (hardwareId) {
           versionText += ' (' + i18n.getMessage('versionLabelTarget') + ': ' + hardwareId + ')';
        }
    }

    return versionText;
}

function getConfiguratorVersion() {
    return i18n.getMessage('versionLabelConfigurator') + ': ' + getManifestVersion();
}

function updateTopBarVersion(firmwareVersion, firmwareId, hardwareId) {
    var versionText = getConfiguratorVersion() + '<br />';

    versionText = versionText + getFirmwareVersion(firmwareVersion, firmwareId, hardwareId);

    $('#logo .logo_text').html(versionText);
}

function updateStatusBarVersion(firmwareVersion, firmwareId, hardwareId) {
    var versionText = '';

    versionText = versionText + getFirmwareVersion(firmwareVersion, firmwareId, hardwareId);

    if (versionText !== '') {
        versionText = versionText + ', ';
    }

    versionText = versionText + getConfiguratorVersion();

    $('#status-bar .version').text(versionText);
}

function getManifestVersion(manifest) {
    if (!manifest) {
        manifest = chrome.runtime.getManifest();
    }

    var version = manifest.version_name;
    if (!version) {
        version = manifest.version;
    }

    return version;
}

function openNewWindowsInExternalBrowser() {
    try {
        var gui = require('nw.gui');

        //Get the current window
        var win = gui.Window.get();

        //Listen to the new window event
        win.on('new-win-policy', function (frame, url, policy) {
          gui.Shell.openExternal(url);
          policy.ignore();
        });
    } catch (ex) {
        console.log("require does not exist, maybe inside chrome");
    }
}
