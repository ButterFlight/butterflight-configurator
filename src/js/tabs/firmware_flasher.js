'use strict';

TABS.firmware_flasher = {
    releases: null,
    releaseChecker: new ReleaseChecker('firmware', 'https://api.github.com/repos/butterflight/butterflight/releases'),
    helioReleaseChecker:  new ReleaseChecker('helioFirmware', 'https://api.github.com/repos/heliorc/imuf-release/contents'),
    helioRgex: new RegExp("butterflight_(\\d\\.\\d\\.\\d).+?IMUF_(\\d\\.\\d\\.\\d(-(\\w{3}))?)(.+)", "i")
};

TABS.firmware_flasher.initialize = function (callback) {
    var self = this;

    if (GUI.active_tab != 'firmware_flasher') {
        GUI.active_tab = 'firmware_flasher';
    }


    var intel_hex = false, // standard intel hex in string format
        parsed_hex = false; // parsed raw hex in array format

        /**
         * Change boldness of firmware option depending on cache status
         * 
         * @param {Descriptor} release 
         */
    function onFirmwareCacheUpdate(release) {
        $("option[value='{0}']".format(release.version))
            .css("font-weight", FirmwareCache.has(release)
                ? "bold"
                : "normal");
    }

    $('#content').load("./tabs/firmware_flasher.html", function () {
        FirmwareCache.load();
        FirmwareCache.onPutToCache(onFirmwareCacheUpdate);
        FirmwareCache.onRemoveFromCache(onFirmwareCacheUpdate);

        function loadReleases() {
            self.releaseChecker.loadReleaseData(function(releaseData){
                self.helioReleaseChecker.loadReleaseData(function(helioReleaseData){
                    buildBoardOptions(releaseData.concat([
                        {
                            "html_url": "https://github.com/heliorc/imuf-release/blob/master/CHANGELOG.md",
                            "body": "You are downloading an aggregate binary from https://github.com/heliorc/imuf-release/. See the release notes here: https://github.com/heliorc/imuf-release/blob/master/CHANGELOG.md",
                            "prerelease": false,
                            "assets": helioReleaseData.filter(function(item){
                                return item.name.endsWith('.hex');
                            }).map(function(item) {
                                let match = self.helioRgex.exec(item.name);
                                item.$date = "RELEASE";
                                item.$target = "HELIOSPRING";
                                item.$version = match[1] + " | IMUF: " + match[2];
                                item.$format = "hex";
                                item.browser_download_url = item.download_url;
                                return item;
                            })
                        }]));
                });
            });
        }
        function parse_hex(str, callback) {
            // parsing hex in different thread
            var worker = new Worker('./js/workers/hex_parser.js');

            // "callback"
            worker.onmessage = function (event) {
                callback(event.data);
            };

            // send data/string over for processing
            worker.postMessage(str);
        }

        function process_hex(data, summary) {
            intel_hex = data;

            parse_hex(intel_hex, function (data) {
                parsed_hex = data;

                if (parsed_hex) {
                    if (!FirmwareCache.has(summary)) {
                        FirmwareCache.put(summary, intel_hex);
                    }

                    var url;

                    $('span.progressLabel').html('<a class="save_firmware" href="#" title="Save Firmware">Loaded Online Firmware: (' + parsed_hex.bytes_total + ' bytes)</a>');

                    $('a.flash_firmware').removeClass('disabled');

                    $('div.release_info .target').text(summary.target);
                    $('div.release_info .name').text(summary.version).prop('href', summary.releaseUrl);
                    $('div.release_info .date').text(summary.date);
                    $('div.release_info .status').text(summary.status);
                    $('div.release_info .file').text(summary.file).prop('href', summary.url);

                    var formattedNotes = summary.notes.replace(/#(\d+)/g, '[#$1](https://github.com/butterflight/butterflight/pull/$1)');
                    formattedNotes = marked(formattedNotes);
                    $('div.release_info .notes').html(formattedNotes);
                    $('div.release_info .notes').find('a').each(function() {
                        $(this).attr('target', '_blank');
                    });

                    $('div.release_info').slideDown();

                } else {
                    $('span.progressLabel').text(i18n.getMessage('firmwareFlasherHexCorrupted'));
                }
            });
        }

        function onLoadSuccess(data, summary) {
            summary = typeof summary === "object" 
                ? summary 
                : $('select[name="firmware_version"] option:selected').data('summary');
            process_hex(data, summary);
            $("a.load_remote_file").removeClass('disabled');
            $("a.load_remote_file").text(i18n.getMessage('firmwareFlasherButtonLoadOnline'));
        };
    
        function buildBoardOptions(releaseData) {
            if (!releaseData) {
                $('select[name="board"]').empty().append('<option value="0">Offline</option>');
                $('select[name="firmware_version"]').empty().append('<option value="0">Offline</option>');
            } else {
                var boards_e = $('select[name="board"]').empty();
                var showDevReleases = ($('input.show_development_releases').is(':checked'));
                boards_e.append($("<option value='0'>{0}</option>".format(i18n.getMessage('firmwareFlasherOptionLabelSelectBoard'))));

                var versions_e = $('select[name="firmware_version"]').empty();
                versions_e.append($("<option value='0'>{0}</option>".format(i18n.getMessage('firmwareFlasherOptionLabelSelectFirmwareVersion'))));

                var releases = {};
                var sortedTargets = [];
                var unsortedTargets = [];                
                releaseData.forEach(function(release){
                    release.assets.forEach(function(asset){
                        var targetFromFilenameExpression = /butterflight_([\d.]+)?_?(\w+)(\-.*)?\.(.*)/i;
                        var match = targetFromFilenameExpression.exec(asset.name);

                        if (!asset.$target && ((!showDevReleases && release.prerelease) || !match)) {
                            return;
                        }

                        var target = asset.$target || match[2];
                        if($.inArray(target, unsortedTargets) == -1) {
                            unsortedTargets.push(target);
                        }
                    });
                    sortedTargets = unsortedTargets.sort();
                });
                sortedTargets.forEach(function(release) {
                    releases[release] = [];
                });

                releaseData.forEach(function(release){
                    var versionFromTagExpression = /v?(.*)/;
                    var matchVersionFromTag = versionFromTagExpression.exec(release.tag_name);
                    var version = matchVersionFromTag[1];

                    release.assets.forEach(function(asset){
                        var targetFromFilenameExpression = /butterflight_([\d.]+)?_?(\w+)(\-.*)?\.(.*)/i;
                        var match = targetFromFilenameExpression.exec(asset.name);

                        if (!asset.$target && ((!showDevReleases && release.prerelease) || !match)) {
                            return;
                        }

                        var target = asset.$target || match[2];
                        var format = asset.$format || match[4];

                        if (format != 'hex') {
                            return;
                        }

                        var date = new Date(release.published_at);
                        var formattedDate = asset.$date || ("0" + date.getDate()).slice(-2) + "-" + ("0"+(date.getMonth()+1)).slice(-2) + "-" + date.getFullYear() + " " + ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2);
                        var descriptor = {
                            "releaseUrl": release.html_url,
                            "name"      : asset.$version || version,
                            "version"   : asset.$version || version,
                            "url"       : asset.browser_download_url,
                            "file"      : asset.name,
                            "target"    : target,
                            "date"      : formattedDate,
                            "notes"     : release.body,
                            "status"    : release.prerelease ? "release-candidate" : "stable"
                        };
                        releases[target].push(descriptor);
                    });
                });
                var selectTargets = [];
                Object.keys(releases)
                    .sort()
                    .forEach(function(target, i) {
                        var descriptors = releases[target];
                        descriptors.forEach(function(descriptor){
                            if($.inArray(target, selectTargets) == -1) {
                                selectTargets.push(target);
                                var select_e =
                                        $("<option value='{0}'>{0}</option>".format(
                                                descriptor.target
                                        )).data('summary', descriptor);
                                boards_e.append(select_e);
                            }
                        });
                    });
                TABS.firmware_flasher.releases = releases;
                chrome.storage.local.get('selected_board', function (result) {
                    if (result.selected_board) {
                        $('select[name="board"]').val(result.selected_board);
                        $('select[name="board"]').trigger("change");
                    }
                });
            }
        };

        // translate to user-selected language
        i18n.localizePage();

        // bind events
        $('input.show_development_releases').click(function () {
            loadReleases();
        });

        $('select[name="board"]').change(function() {
            $("a.load_remote_file").addClass('disabled');
            var target = $(this).val() || Object.keys(TABS.firmware_flasher.releases)[0];

            if (!GUI.connect_lock) {
                $('.progress').val(0).removeClass('valid invalid');
                $('span.progressLabel').text(i18n.getMessage('firmwareFlasherLoadFirmwareFile'));
                $('div.git_info').slideUp();
                $('div.release_info').slideUp();
                $('a.flash_firmware').addClass('disabled');

                var versions_e = $('select[name="firmware_version"]').empty();
                if(target == 0) {
                    versions_e.append($("<option value='0'>{0}</option>".format(i18n.getMessage('firmwareFlasherOptionLabelSelectFirmwareVersion'))));
                } else {
                    versions_e.append($("<option value='0'>{0} {1}</option>".format(i18n.getMessage('firmwareFlasherOptionLabelSelectFirmwareVersionFor'), target)));
                }

                TABS.firmware_flasher.releases[target].forEach(function(descriptor) {
                    var select_e =
                            $("<option value='{0}'>{0} - {1} - {2} ({3})</option>".format(
                                    descriptor.version,
                                    descriptor.target,
                                    descriptor.date,
                                    descriptor.status
                            ))
                            .css("font-weight", FirmwareCache.has(descriptor)
                                    ? "bold"
                                    : "normal"
                            )
                            .data('summary', descriptor);

                    versions_e.append(select_e);
                });
            }
            chrome.storage.local.set({'selected_board': target});
        });

        // UI Hooks
        $('a.load_file').click(function () {
            chrome.fileSystem.chooseEntry({type: 'openFile', accepts: [{extensions: ['hex']}]}, function (fileEntry) {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);

                    return;
                }

                // hide github info (if it exists)
                $('div.git_info').slideUp();

                chrome.fileSystem.getDisplayPath(fileEntry, function (path) {
                    console.log('Loading file from: ' + path);

                    fileEntry.file(function (file) {
                        var reader = new FileReader();

                        reader.onprogress = function (e) {
                            if (e.total > 1048576) { // 1 MB
                                // dont allow reading files bigger then 1 MB
                                console.log('File limit (1 MB) exceeded, aborting');
                                reader.abort();
                            }
                        };

                        reader.onloadend = function(e) {
                            if (e.total != 0 && e.total == e.loaded) {
                                console.log('File loaded');

                                intel_hex = e.target.result;

                                parse_hex(intel_hex, function (data) {
                                    parsed_hex = data;

                                    if (parsed_hex) {
                                        $('a.flash_firmware').removeClass('disabled');

                                        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherFirmwareLocalLoaded', parsed_hex.bytes_total));
                                    } else {
                                        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherHexCorrupted'));
                                    }
                                });
                            }
                        };

                        reader.readAsText(file);
                    });
                });
            });
        });

        /**
         * Lock / Unlock the firmware download button according to the firmware selection dropdown.
         */
        $('select[name="firmware_version"]').change(function(evt){
            $('div.release_info').slideUp();
            $('a.flash_firmware').addClass('disabled');
            let release = $("option:selected", evt.target).data("summary");
            let isCached = FirmwareCache.has(release);
            if (evt.target.value=="0" || isCached) {
                if (isCached) {
                    FirmwareCache.get(release, cached => {
                        console.info("Release found in cache: " + release.file);
                        onLoadSuccess(cached.hexdata, release);
                    });
                }
                $("a.load_remote_file").addClass('disabled');
            }
            else {
                $("a.load_remote_file").removeClass('disabled');
            }
        });

        $('a.load_remote_file').click(function (evt) {

            if ($('select[name="firmware_version"]').val() == "0") {
                GUI.log(i18n.getMessage('firmwareFlasherNoFirmwareSelected'));
                return;
            }

            function failed_to_load() {
                $('span.progressLabel').text(i18n.getMessage('firmwareFlasherFailedToLoadOnlineFirmware'));
                $('a.flash_firmware').addClass('disabled');
                $("a.load_remote_file").removeClass('disabled');
                $("a.load_remote_file").text(i18n.getMessage('firmwareFlasherButtonLoadOnline'));
            }

            var summary = $('select[name="firmware_version"] option:selected').data('summary');
            if (summary) { // undefined while list is loading or while running offline
                $("a.load_remote_file").text(i18n.getMessage('firmwareFlasherButtonDownloading'));
                $("a.load_remote_file").addClass('disabled');
                $.get(summary.url, onLoadSuccess).fail(failed_to_load);
            } else {
                $('span.progressLabel').text(i18n.getMessage('firmwareFlasherFailedToLoadOnlineFirmware'));
            }
        });

        $('a.flash_firmware').click(function () {
            if (!$(this).hasClass('disabled')) {
                if (!GUI.connect_lock) { // button disabled while flashing is in progress
                    if (parsed_hex != false) {
                        var options = {};

                        if ($('input.erase_chip').is(':checked')) {
                            options.erase_chip = true;
                        }

                        if (String($('div#port-picker #port').val()) != 'DFU') {
                            if (String($('div#port-picker #port').val()) != '0') {
                                var port = String($('div#port-picker #port').val()),
                                    baud;
                                baud = 115200;

                                if ($('input.updating').is(':checked')) {
                                    options.no_reboot = true;
                                } else {
                                    options.reboot_baud = parseInt($('div#port-picker #baud').val());
                                }

                                if ($('input.flash_manual_baud').is(':checked')) {
                                    baud = parseInt($('#flash_manual_baud_rate').val());
                                }


                                STM32.connect(port, baud, parsed_hex, options);
                            } else {
                                console.log('Please select valid serial port');
                                GUI.log(i18n.getMessage('firmwareFlasherNoValidPort'));
                            }
                        } else {
                            STM32DFU.connect(usbDevices.STM32DFU, parsed_hex, options);
                        }
                    } else {
                        $('span.progressLabel').text(i18n.getMessage('firmwareFlasherFirmwareNotLoaded'));
                    }
                }
            }
        });

        $(document).on('click', 'span.progressLabel a.save_firmware', function () {
            var summary = $('select[name="firmware_version"] option:selected').data('summary');
            chrome.fileSystem.chooseEntry({type: 'saveFile', suggestedName: summary.file, accepts: [{extensions: ['hex']}]}, function (fileEntry) {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    return;
                }

                chrome.fileSystem.getDisplayPath(fileEntry, function (path) {
                    console.log('Saving firmware to: ' + path);

                    // check if file is writable
                    chrome.fileSystem.isWritableEntry(fileEntry, function (isWritable) {
                        if (isWritable) {
                            var blob = new Blob([intel_hex], {type: 'text/plain'});

                            fileEntry.createWriter(function (writer) {
                                var truncated = false;

                                writer.onerror = function (e) {
                                    console.error(e);
                                };

                                writer.onwriteend = function() {
                                    if (!truncated) {
                                        // onwriteend will be fired again when truncation is finished
                                        truncated = true;
                                        writer.truncate(blob.size);

                                        return;
                                    }
                                };

                                writer.write(blob);
                            }, function (e) {
                                console.error(e);
                            });
                        } else {
                            console.log('You don\'t have write permissions for this file, sorry.');
                            GUI.log(i18n.getMessage('firmwareFlasherWritePermissions'));
                        }
                    });
                });
            });
        });

        chrome.storage.local.get('no_reboot_sequence', function (result) {
            if (result.no_reboot_sequence) {
                $('input.updating').prop('checked', true);
                $('.flash_on_connect_wrapper').show();
            } else {
                $('input.updating').prop('checked', false);
            }

            // bind UI hook so the status is saved on change
            $('input.updating').change(function() {
                var status = $(this).is(':checked');

                if (status) {
                    $('.flash_on_connect_wrapper').show();
                } else {
                    $('input.flash_on_connect').prop('checked', false).change();
                    $('.flash_on_connect_wrapper').hide();
                }

                chrome.storage.local.set({'no_reboot_sequence': status});
            });

            $('input.updating').change();
        });

        chrome.storage.local.get('flash_manual_baud', function (result) {
            if (result.flash_manual_baud) {
                $('input.flash_manual_baud').prop('checked', true);
            } else {
                $('input.flash_manual_baud').prop('checked', false);
            }

            // bind UI hook so the status is saved on change
            $('input.flash_manual_baud').change(function() {
                var status = $(this).is(':checked');
                chrome.storage.local.set({'flash_manual_baud': status});
            });

            $('input.flash_manual_baud').change();
        });

        chrome.storage.local.get('flash_manual_baud_rate', function (result) {
            $('#flash_manual_baud_rate').val(result.flash_manual_baud_rate);

            // bind UI hook so the status is saved on change
            $('#flash_manual_baud_rate').change(function() {
                var baud = parseInt($('#flash_manual_baud_rate').val());
                chrome.storage.local.set({'flash_manual_baud_rate': baud});
            });

            $('input.flash_manual_baud_rate').change();
        });

        $('input.flash_on_connect').change(function () {
            var status = $(this).is(':checked');

            if (status) {
                var catch_new_port = function () {
                    PortHandler.port_detected('flash_detected_device', function (result) {
                        var port = result[0];

                        if (!GUI.connect_lock) {
                            GUI.log(i18n.getMessage('firmwareFlasherFlashTrigger', [port]));
                            console.log('Detected: ' + port + ' - triggering flash on connect');

                            // Trigger regular Flashing sequence
                            GUI.timeout_add('initialization_timeout', function () {
                                $('a.flash_firmware').click();
                            }, 100); // timeout so bus have time to initialize after being detected by the system
                        } else {
                            GUI.log(i18n.getMessage('firmwareFlasherPreviousDevice', [port]));
                        }

                        // Since current port_detected request was consumed, create new one
                        catch_new_port();
                    }, false, true);
                };

                catch_new_port();
            } else {
                PortHandler.flush_callbacks();
            }
        }).change();

        chrome.storage.local.get('erase_chip', function (result) {
            if (result.erase_chip) {
                $('input.erase_chip').prop('checked', true);
            } else {
                $('input.erase_chip').prop('checked', false);
            }

            $('input.erase_chip').change(function () {
                chrome.storage.local.set({'erase_chip': $(this).is(':checked')});
            }).change();
        });

        chrome.storage.local.get('show_development_releases', function (result) {
            if (result.show_development_releases) {
                $('input.show_development_releases').prop('checked', true);
            } else {
                $('input.show_development_releases').prop('checked', false);
            }

            loadReleases();

            $('input.show_development_releases').change(function () {
                chrome.storage.local.set({'show_development_releases': $(this).is(':checked')});
            }).change();
        });

        $(document).keypress(function (e) {
            if (e.which == 13) { // enter
                // Trigger regular Flashing sequence
                $('a.flash_firmware').click();
            }
        });

        GUI.content_ready(callback);
    });
};

TABS.firmware_flasher.cleanup = function (callback) {
    PortHandler.flush_callbacks();
    FirmwareCache.unload();

    // unbind "global" events
    $(document).unbind('keypress');
    $(document).off('click', 'span.progressLabel a');

    if (callback) callback();
};
