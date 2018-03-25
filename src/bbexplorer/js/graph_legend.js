"use strict";

function GraphLegend(targetElem, config, onVisibilityChange, onNewSelectionChange, onZoomGraph, onExpandGraph, onNewGraphConfig) {
    var
        that = this;

    function buildLegend() {
        var 
            graphs = config.getGraphs(),
            i, j;
        
        targetElem.empty();

        for (i = 0; i < graphs.length; i++) {
            var 
                graph = graphs[i],
                graphDiv = $('<div class="graph-legend no-wheel" id="' + i +'"><h3 class="graph-legend-group" graph="' + i + '"></h3><ul class="list-unstyled graph-legend-field-list no-wheel"></ul></div>'),
                graphTitle = $("h3", graphDiv),
                fieldList = $("ul", graphDiv);
            
            graphTitle.text(graph.label);
            graphTitle.prepend('<span class="glyphicon glyphicon-minus no-wheel"></span>');
            
            for (j = 0; j < graph.fields.length; j++) { 
                var 
                    field = graph.fields[j],
                    li = $('<li class="graph-legend-field" name="' + field.name + '" graph="' + i + '" field="' + j +'"></li>');
                
                li.text(FlightLogFieldPresenter.fieldNameToFriendly(field.name));
                li.css('border-bottom', "2px solid " + field.color);
                fieldList.append(li);
            }
            
            targetElem.append(graphDiv);
        }

        // Add a trigger on legend; select the analyser graph/field to plot
        $('.graph-legend-field').on('click', function(e) {

            if(e.which!=1) return; // only accept left mouse clicks

            var
               selectedGraphIndex    = $(this).attr('graph'),
               selectedFieldIndex    = $(this).attr('field');

           if(!e.altKey) {
               config.selectedFieldName     = FlightLogFieldPresenter.fieldNameToFriendly($(this).attr('name'));
               config.selectedGraphIndex    = selectedGraphIndex;
               config.selectedFieldIndex    = selectedFieldIndex;
               if (onNewSelectionChange) {
                   onNewSelectionChange();
               }
           } else { // toggle the grid setting
               var graphs = config.getGraphs();
               for(var i=0; i<graphs[selectedGraphIndex].fields.length; i++) {
                  graphs[selectedGraphIndex].fields[i].grid = ((i==selectedFieldIndex)?(!graphs[selectedGraphIndex].fields[i].grid):false);
               };
               if (onNewGraphConfig) {
                   onNewGraphConfig(graphs);
               }
           };
           e.preventDefault();
        });

        // Add a trigger on legend list title; select the graph to expland
        $('.graph-legend h3').on('click', function(e) {

               if(e.which!=1) return; // only accept left mouse clicks

               var selectedGraph = $(this).attr('graph');
               if(!e.altKey) {
                   if (onZoomGraph) {                   
                       onZoomGraph(selectedGraph);
                   }
               } else {
                   if (onExpandGraph) {                   
                       onExpandGraph(selectedGraph);
                   }
               }
           e.preventDefault();
        });

        // Make the legend dragabble
        $('.log-graph-legend').sortable( 
            {
                update: function( event, ui ) { 
                            var newOrder = $('.log-graph-legend').sortable('toArray');
                            var newGraphs = [];
                            var oldGraphs = config.getGraphs();
                            for(var i=0; i<newOrder.length; i++) {
                                newGraphs[i] = oldGraphs[newOrder[i]];
                            }
                            config.setGraphs(newGraphs);
                      },
                cursor: "move",
            }
        );
        $('.log-graph-legend').disableSelection();        

        $('.log-close-legend-dialog').on('click', function() {
            that.hide();
        });
        
        $('.log-open-legend-dialog').on('click', function() {
            that.show();
        });

        // on first show, hide the analyser button
        if(!config.selectedFieldName) $('.hide-analyser-window').hide();
    }

    this.updateValues = function(flightLog, frame) {
      try {  
          // New function to show values on legend.
          var currentFlightMode = frame[flightLog.getMainFieldIndexByName("flightModeFlags")];
          
              $(".graph-legend-field").each(function(index, value) {
                  var value = frame[flightLog.getMainFieldIndexByName($(this).attr('name'))]; // get the raw value from log
                  if(userSettings.legendUnits) { // if we want the legend to show engineering units
                      value = FlightLogFieldPresenter.decodeFieldToFriendly(flightLog, $(this).attr('name'), value, currentFlightMode);
                  } else { // raw value
                    if(value%1!=0) { value = value.toFixed(2); }
                  }
                  $(this).text(FlightLogFieldPresenter.fieldNameToFriendly($(this).attr('name'), flightLog.getSysConfig().debug_mode) + ((value!=null)?' (' + value + ')':' ') );
                  $(this).append('<span class="glyphicon glyphicon-equalizer no-wheel"></span>');
              });
          } catch(e) {
              console.log('Cannot update legend with values');
          }
    };
    
    this.show = function() {
        $('.log-graph-config').show();
        $('.log-open-legend-dialog').hide();
        
        if (onVisibilityChange) {
            onVisibilityChange(false);
        }
    };
    
    this.hide = function() {
        $('.log-graph-config').hide();
        $('.log-open-legend-dialog').show();
        
        if (onVisibilityChange) {
            onVisibilityChange(true);
        }
    };
    
    config.addListener(buildLegend);
    
    buildLegend();
}