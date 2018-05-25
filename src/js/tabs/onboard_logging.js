'use strict';

var
    sdcardTimer;

TABS.onboard_logging = {
    blockSize: 128,
    writeError: false,

    BLOCK_SIZE: 4096,
    VCP_BLOCK_SIZE_3_0: 512,
    VCP_BLOCK_SIZE: 4096
};
TABS.onboard_logging.initialize = function (callback) {
    var 
        self = this,
        saveCancelled, eraseCancelled;

    if (GUI.active_tab !== 'onboard_logging') {
        GUI.active_tab = 'onboard_logging';
    }

    if (CONFIGURATOR.connectionValid) {

        MSP.send_message(MSPCodes.MSP_FEATURE_CONFIG, false, false, function() {
            MSP.send_message(MSPCodes.MSP_DATAFLASH_SUMMARY, false, false, function() {
                MSP.send_message(MSPCodes.MSP_SDCARD_SUMMARY, false, false, function() {
                    MSP.send_message(MSPCodes.MSP_BLACKBOX_CONFIG, false, false, function() { 
                        MSP.send_message(MSPCodes.MSP_ADVANCED_CONFIG, false, false, function() {
                            MSP.send_message(MSPCodes.MSP_NAME, false, false, load_html);
                        });
                    });
                });
            });
        });
    }
    
    function gcd(a, b) {
        if (b === 0)
            return a;
        
        return gcd(b, a % b);
    }
    
    function save_to_eeprom() {
        MSP.send_message(MSPCodes.MSP_EEPROM_WRITE, false, false, reboot);
    }

    function reboot() {
        GUI.log(i18n.getMessage('configurationEepromSaved'));

        GUI.tab_switch_cleanup(function() {
            MSP.send_message(MSPCodes.MSP_SET_REBOOT, false, false, reinitialize);
        });
    }

    function reinitialize() {
        GUI.log(i18n.getMessage('deviceRebooting'));

        if (BOARD.find_board_definition(CONFIG.boardIdentifier).vcp) { // VCP-based flight controls may crash old drivers, we catch and reconnect
            $('a.connect').click();
            GUI.timeout_add('start_connection',function start_connection() {
                $('a.connect').click();
            },2000);
        } else {

            GUI.timeout_add('waiting_for_bootup', function waiting_for_bootup() {
                MSP.send_message(MSPCodes.MSP_STATUS, false, false, function() {
                    GUI.log(i18n.getMessage('deviceReady'));
                    TABS.onboard_logging.initialize(false, $('#content').scrollTop());
                });
            },1500); // 1500 ms seems to be just the right amount of delay to prevent data request timeouts
        }
    }
    
    function load_html() {
        $('#content').load("./tabs/onboard_logging.html", function() {
            // translate to user-selected language
            i18n.localizePage();
           
            var 
                dataflashPresent = DATAFLASH.totalSize > 0,
                blackboxSupport;
                
            /* 
             * Pre-1.11.0 firmware supported DATAFLASH API (on targets with SPI flash) but not the BLACKBOX config API.
             * 
             * The best we can do on those targets is check the BLACKBOX feature bit to identify support for Blackbox instead.
             */
            if ((BLACKBOX.supported || DATAFLASH.supported) && (semver.gte(CONFIG.apiVersion, "1.33.0") || FEATURE_CONFIG.features.isEnabled('BLACKBOX'))) {
                blackboxSupport = 'yes';
            } else {
                blackboxSupport = 'no';
            }
            
            $(".tab-onboard_logging")
                .addClass("serial-supported")
                .toggleClass("dataflash-supported", DATAFLASH.supported)
                .toggleClass("dataflash-present", dataflashPresent)
                .toggleClass("sdcard-supported", SDCARD.supported)
                .toggleClass("blackbox-config-supported", BLACKBOX.supported)
                
                .toggleClass("blackbox-supported", blackboxSupport === 'yes')
                .toggleClass("blackbox-maybe-supported", blackboxSupport === 'maybe')
                .toggleClass("blackbox-unsupported", blackboxSupport === 'no');

            if (dataflashPresent) {
                // UI hooks
                $('.tab-onboard_logging a.erase-flash').click(ask_to_erase_flash);
                
                $('.tab-onboard_logging a.erase-flash-confirm').click(flash_erase);
                $('.tab-onboard_logging a.erase-flash-cancel').click(flash_erase_cancel);
        
                $('.tab-onboard_logging a.save-flash').click(flash_save_begin);
                $('.tab-onboard_logging a.save-flash-cancel').click(flash_save_cancel);
                $('.tab-onboard_logging a.save-flash-dismiss').click(dismiss_saving_dialog);
            }

            var deviceSelect = $(".blackboxDevice select");
            var loggingRatesSelect = $(".blackboxRate select");

            if (BLACKBOX.supported) {
                $(".tab-onboard_logging a.save-settings").click(function() {
                    if (semver.gte(CONFIG.apiVersion, "1.36.0")) {
                        BLACKBOX.blackboxPDenom = parseInt(loggingRatesSelect.val(), 10);
                    } else {
                        var rate = loggingRatesSelect.val().split('/');
                        BLACKBOX.blackboxRateNum = parseInt(rate[0], 10);
                        BLACKBOX.blackboxRateDenom = parseInt(rate[1], 10);
                    }

                    BLACKBOX.blackboxDevice = parseInt(deviceSelect.val(), 10);
                    
                    MSP.send_message(MSPCodes.MSP_SET_BLACKBOX_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_BLACKBOX_CONFIG), false, save_to_eeprom);
                });
            }
            
            populateLoggingRates(loggingRatesSelect);
            populateDevices(deviceSelect);

            deviceSelect.change(function() {
                if ($(this).val() === "0") {
                    $("div.blackboxRate").hide();
                } else {
                    $("div.blackboxRate").show();
                }
            }).change();
            
            update_html();
            
            GUI.content_ready(callback);
        });
    }
    
    function populateDevices(deviceSelect) {
        deviceSelect.empty();

        if (semver.gte(CONFIG.apiVersion, "1.33.0")) {
            deviceSelect.append('<option value="0">' + i18n.getMessage('blackboxLoggingNone') + '</option>');
            if (DATAFLASH.supported) {
                deviceSelect.append('<option value="1">' + i18n.getMessage('blackboxLoggingFlash') + '</option>');
            }
            if (SDCARD.supported) {
                deviceSelect.append('<option value="2">' + i18n.getMessage('blackboxLoggingSdCard') + '</option>');
            }
            deviceSelect.append('<option value="3">' + i18n.getMessage('blackboxLoggingSerial') + '</option>');
        } else {
            deviceSelect.append('<option value="0">' + i18n.getMessage('blackboxLoggingSerial') + '</option>');
            if (DATAFLASH.ready) {
                deviceSelect.append('<option value="1">' + i18n.getMessage('blackboxLoggingFlash') + '</option>');
            }
            if (SDCARD.supported) {
                deviceSelect.append('<option value="2">' + i18n.getMessage('blackboxLoggingSdCard') + '</option>');
            }
        }

        deviceSelect.val(BLACKBOX.blackboxDevice);
    }
    
    function populateLoggingRates(loggingRatesSelect) {
        
        // Offer a reasonable choice of logging rates (if people want weird steps they can use CLI)
        var loggingRates = [];
        var pidRateBase = 8000;

        if (PID_ADVANCED_CONFIG.gyroUse32kHz !== 0) {
            pidRateBase = 32000;
        }

        var pidRate = pidRateBase / PID_ADVANCED_CONFIG.gyro_sync_denom / 
        PID_ADVANCED_CONFIG.pid_process_denom; 

        if (semver.gte(CONFIG.apiVersion, "1.36.0")) {
            loggingRatesSelect.append(new Option("Disabled",   0));
            loggingRatesSelect.append(new Option("500 Hz",     16));
            loggingRatesSelect.append(new Option("1 kHz",      32));
            loggingRatesSelect.append(new Option("1.5 kHz",    48));
            loggingRatesSelect.append(new Option("2 kHz",      64));
            loggingRatesSelect.append(new Option("4 kHz",      128));
            loggingRatesSelect.append(new Option("8 kHz",      256));
            if (PID_ADVANCED_CONFIG.gyroUse32kHz) {
                loggingRatesSelect.append(new Option("16 kHz", 512));
                loggingRatesSelect.append(new Option("32 kHz", 1024));
            }
            loggingRatesSelect.val(BLACKBOX.blackboxPDenom);
        }
        else {
            loggingRates = [
                    {num: 1, denom: 1},
                    {num: 1, denom: 2},
                    {num: 1, denom: 3},
                    {num: 1, denom: 4},
                    {num: 1, denom: 5},
                    {num: 1, denom: 6},
                    {num: 1, denom: 7},
                    {num: 1, denom: 8},
                    {num: 1, denom: 16},
                    {num: 1, denom: 32}
                ];

            
            for (var i = 0; i < loggingRates.length; i++) {
                var loggingRate = Math.round(pidRate / loggingRates[i].denom);
                var loggingRateUnit = " Hz";
                if (loggingRate !== Infinity) {
                    if (gcd(loggingRate, 1000) === 1000) {
                        loggingRate /= 1000;
                        loggingRateUnit = " KHz";	
                    }
                }
                loggingRatesSelect.append('<option value="' + loggingRates[i].num + '/' + loggingRates[i].denom + '">' 
                    + loggingRate + loggingRateUnit + ' (' + Math.round(loggingRates[i].num / loggingRates[i].denom * 100) + '%)</option>');
                
            }
            loggingRatesSelect.val(BLACKBOX.blackboxRateNum + '/' + BLACKBOX.blackboxRateDenom);
        }
    }
    
    function formatFilesizeKilobytes(kilobytes) {
        if (kilobytes < 1024) {
            return Math.round(kilobytes) + "kB";
        }
        
        var 
            megabytes = kilobytes / 1024,
            gigabytes;
        
        if (megabytes < 900) {
            return megabytes.toFixed(1) + "MB";
        } else {
            gigabytes = megabytes / 1024;
            
            return gigabytes.toFixed(1) + "GB";
        }
    }
    
    function formatFilesizeBytes(bytes) {
        if (bytes < 1024) {
            return bytes + "B";
        }
        return formatFilesizeKilobytes(bytes / 1024);
    }
    
    function update_bar_width(bar, value, total, label, valuesAreKilobytes) {
        if (value > 0) {
            bar.css({
                width: (value / total * 100) + "%",
                display: 'block'
            });
            
            $("div", bar).text((label ? label + " " : "") + (valuesAreKilobytes ? formatFilesizeKilobytes(value) : formatFilesizeBytes(value)));
        } else {
            bar.css({
                display: 'none'
            });
        }
    }
    
    function update_html() {
        update_bar_width($(".tab-onboard_logging .dataflash-used"), DATAFLASH.usedSize, DATAFLASH.totalSize, i18n.getMessage('dataflashUsedSpace'), false);
        update_bar_width($(".tab-onboard_logging .dataflash-free"), DATAFLASH.totalSize - DATAFLASH.usedSize, DATAFLASH.totalSize, i18n.getMessage('dataflashFreeSpace'), false);

        update_bar_width($(".tab-onboard_logging .sdcard-other"), SDCARD.totalSizeKB - SDCARD.freeSizeKB, SDCARD.totalSizeKB, i18n.getMessage('dataflashUnavSpace'), true);
        update_bar_width($(".tab-onboard_logging .sdcard-free"), SDCARD.freeSizeKB, SDCARD.totalSizeKB, i18n.getMessage('dataflashLogsSpace'), true);

        $(".btn a.erase-flash, .btn a.save-flash").toggleClass("disabled", DATAFLASH.usedSize === 0);
        
        $(".tab-onboard_logging")
            .toggleClass("sdcard-error", SDCARD.state === MSP.SDCARD_STATE_FATAL)
            .toggleClass("sdcard-initializing", SDCARD.state === MSP.SDCARD_STATE_CARD_INIT || SDCARD.state === MSP.SDCARD_STATE_FS_INIT)
            .toggleClass("sdcard-ready", SDCARD.state === MSP.SDCARD_STATE_READY);
        
        switch (SDCARD.state) {
            case MSP.SDCARD_STATE_NOT_PRESENT:
                $(".sdcard-status").text(i18n.getMessage('sdcardStatusNoCard'));
            break;
            case MSP.SDCARD_STATE_FATAL:
                $(".sdcard-status").html(i18n.getMessage('sdcardStatusReboot'));
            break;
            case MSP.SDCARD_STATE_READY:
                $(".sdcard-status").text(i18n.getMessage('sdcardStatusReady'));
            break;
            case MSP.SDCARD_STATE_CARD_INIT:
                $(".sdcard-status").text(i18n.getMessage('sdcardStatusStarting'));
            break;
            case MSP.SDCARD_STATE_FS_INIT:
                $(".sdcard-status").text(i18n.getMessage('sdcardStatusFileSystem'));
            break;
            default:
                $(".sdcard-status").text(i18n.getMessage('sdcardStatusUnknown',[SDCARD.state]));
        }
        
        if (SDCARD.supported && !sdcardTimer) {
            // Poll for changes in SD card status
            sdcardTimer = setTimeout(function() {
                sdcardTimer = false;
                if (CONFIGURATOR.connectionValid) {
                    MSP.send_message(MSPCodes.MSP_SDCARD_SUMMARY, false, false, function() {
                        update_html();
                    });
                }
            }, 2000);
        }
    }
    
    // IO related methods
    function flash_save_cancel() {
        saveCancelled = true;
    }
    
    function show_saving_dialog() {
        $(".dataflash-saving progress").attr("value", 0);
        saveCancelled = false;
        $(".dataflash-saving").removeClass("done");
        
        $(".dataflash-saving")[0].showModal();
    }
    
    function dismiss_saving_dialog() {
        $(".dataflash-saving")[0].close();
    }
    
    function mark_saving_dialog_done(startTime, totalBytes, totalBytesCompressed) {
        var totalTime = (new Date().getTime() - startTime) / 1000;
        console.log('Received ' + totalBytes + ' bytes in ' + totalTime.toFixed(2) + 's ('
            + (totalBytes / totalTime / 1024).toFixed(2) + 'kB / s) with block size ' + self.blockSize + '.');
        if (totalBytesCompressed) {
            console.log('Compressed into', totalBytesCompressed, 'bytes with mean compression factor of', totalBytes / totalBytesCompressed);
        }


        $(".dataflash-saving").addClass("done");
    }
    
    function flash_update_summary(onDone) {
        MSP.send_message(MSPCodes.MSP_DATAFLASH_SUMMARY, false, false, function() {
            update_html();
            
            if (onDone) {
                onDone();
            }
        });
    }
    
    function flash_save_begin() {
        if (GUI.connected_to) {
            if (BOARD.find_board_definition(CONFIG.boardIdentifier).vcp) {
                if (semver.gte(CONFIG.apiVersion, "1.31.0")) {
                    self.blockSize = self.VCP_BLOCK_SIZE;
                } else {
                    self.blockSize = self.VCP_BLOCK_SIZE_3_0;
                }
            } else {
                self.blockSize = self.BLOCK_SIZE;
            }

            // Begin by refreshing the occupied size in case it changed while the tab was open
            flash_update_summary(function() {
                var maxBytes = DATAFLASH.usedSize;
                
                prepare_file(function(fileWriter) {
                    var nextAddress = 0;
                    var totalBytesCompressed = 0;
                    
                    show_saving_dialog();
                    
                    function onChunkRead(chunkAddress, chunkDataView, bytesCompressed) {
                        if (chunkDataView !== null) {
                            // Did we receive any data?
                            if (chunkDataView.byteLength > 0) {
                                nextAddress += chunkDataView.byteLength;
                                totalBytesCompressed += bytesCompressed;
                                
                                $(".dataflash-saving progress").attr("value", nextAddress / maxBytes * 100);

                                var blob = new Blob([chunkDataView]);
                                
                                fileWriter.onwriteend = function(e) {
                                    if (saveCancelled || nextAddress >= maxBytes) {
                                        if (saveCancelled) {
                                            dismiss_saving_dialog();
                                        } else {
                                            mark_saving_dialog_done(startTime, nextAddress, totalBytesCompressed);
                                        }
                                    } else {
                                        if (!self.writeError) {
                                            mspHelper.dataflashRead(nextAddress, self.blockSize, onChunkRead);
                                        } else {
                                            dismiss_saving_dialog();
                                        }
                                    }
                                };
                                
                                fileWriter.write(blob);
                            } else {
                                // A zero-byte block indicates end-of-file, so we're done
                                mark_saving_dialog_done(startTime, nextAddress, totalBytesCompressed);
                            }
                        } else {
                            // There was an error with the received block (address didn't match the one we asked for), retry
                            mspHelper.dataflashRead(nextAddress, self.blockSize, onChunkRead);
                        }
                    }

                    var startTime = new Date().getTime();
                    // Fetch the initial block
                    mspHelper.dataflashRead(nextAddress, self.blockSize, onChunkRead);
                });
            });
        }
    }
    
    function prepare_file(onComplete) {
        
        var prefix = 'BLACKBOX_LOG';
        var suffix = 'BBL';

        var filename = generateFilename(prefix, suffix);

        chrome.fileSystem.chooseEntry({type: 'saveFile', suggestedName: filename, 
                accepts: [{extensions: [suffix]}]}, function(fileEntry) {
            var error = chrome.runtime.lastError;
            
            if (error) {
                console.error(error.message);
                
                if (error.message !== "User cancelled") {
                    GUI.log(i18n.getMessage('dataflashFileWriteFailed'));
                }
                return;
            }
            
            // echo/console log path specified
            chrome.fileSystem.getDisplayPath(fileEntry, function(path) {
                console.log('Dataflash dump file path: ' + path);
            });

            fileEntry.createWriter(function (fileWriter) {
                fileWriter.onerror = function (e) {
                    GUI.log('<strong><span class="message-negative">' + i18n.getMessage('error', { errorMessage: e.target.error.message }) + '</span class="message-negative></strong>');
                        
                    console.error(e);

                    // stop logging if the procedure was/is still running
                    self.writeError = true;
                };

                onComplete(fileWriter);
            }, function (e) {
                // File is not readable or does not exist!
                console.error(e);
                GUI.log(i18n.getMessage('dataflashFileWriteFailed'));
            });
        });
    }
    
    function ask_to_erase_flash() {
        eraseCancelled = false;
        $(".dataflash-confirm-erase").removeClass('erasing');

        $(".dataflash-confirm-erase")[0].showModal(); 
    }

    function poll_for_erase_completion() {
        flash_update_summary(function() {
            if (CONFIGURATOR.connectionValid && !eraseCancelled) {
                if (DATAFLASH.ready) {
                    $(".dataflash-confirm-erase")[0].close();
                } else {
                    setTimeout(poll_for_erase_completion, 500);
                }
            }
        });
    }
    
    function flash_erase() {
        $(".dataflash-confirm-erase").addClass('erasing');
        
        MSP.send_message(MSPCodes.MSP_DATAFLASH_ERASE, false, false, poll_for_erase_completion);
    }
    
    function flash_erase_cancel() {
        eraseCancelled = true;
        $(".dataflash-confirm-erase")[0].close();
    }
};

TABS.onboard_logging.cleanup = function (callback) {
    if (sdcardTimer) {
        clearTimeout(sdcardTimer);
        sdcardTimer = false;
    }
    
    if (callback) {
        callback();
    }
};
