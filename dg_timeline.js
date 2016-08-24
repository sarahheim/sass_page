//Author: Sarah Heim
//Description: make Dygraphs, currently for Automated Shore Stations
// Two main options:
// "Single Station" - all attributes for a single station
// "Compare Stations" - single attribute for all stations
//~~~~~~~~~~~~~~~~ Global variables ~~~~~~~~~~~~~~~~~~~~~~~~
var dg, dgData;
var attr, sensor;
var sensorStartDate, sensorEndDate;
var baseERDDAP = 'http://sccoos.org/erddap/tabledap/autoss';
var baseJSON = baseERDDAP+'.json';
var flagsArr = [ "pressure", "temperature", "chlorophyll", "salinity"];
//var staAbbr = ['UCSB', 'UCLA', 'UCI', 'UCSD'];
var staAbbr = ['stearns_wharf', 'santa_monica_pier', 'newport_pier', 'scripps_pier'];
var sensorsArr = ['conductivity', 'sigmat', 'diagnosticVoltage', 'currentDraw', 'aux1', 'aux3', 'aux4']
var attrsArr = flagsArr.concat(sensorsArr);
///All browsers should display time local (Pacific) regardless of location
moment.tz.setDefault("America/Los_Angeles");
/*
var attrCharts = {};
psFlagsArr = [];
$.each(flagsArr, function(f, fAttr) {
  psFlagsArr.push(fAttr+'_flagPrimary');
  psFlagsArr.push(fAttr+'_flagSecondary');
});
var allArr = attrsArr.concat(psFlagsArr);
var dataDict;
*/
var stationsMeta = { 
//Dark colors
//UCLA border #909, fill #FCF},
  'stearns_wharf': { 'name': 'Stearns Wharf', 'border-color':'#099', 'fill-color':'#CFF'},
  'santa_monica_pier': { 'name': 'Santa Monica Pier', 'border-color':'#333', 'fill-color':'#DDD'},
  'newport_pier':  { 'name': 'Newport Pier', 'border-color':'#990', 'fill-color':'#FFA'},
  'scripps_pier': { 'name': 'Scripps Pier', 'border-color':'#409', 'fill-color':'#CCF'}
};
//appendTime = '&time>=2015-01-01T00:00:00.000Z&time<2016-01-01T00:00:00Z&orderBy("time")'
appendTime = '&time>2016-01-01T00:00:00.000Z&orderBy("time")'
//appendTime = '&orderBy("time")' //ALL TIME
//appendTime = '&time>2011-01-01T00:00:00.000Z&orderBy("time")'

///Default Dygraph options
defDgOpts = {
    drawPoints: true,
    pointSize:2,
    highlightCircleSize: 4,
    connectSeparatedPoints: true,

    height: 500,
    labelsSeparateLines: true,
    labelsDiv: "chart-labels",
    legend: "always", //"follow",

    axisLabelFontSize: 11,
    xlabel: "Local Pacific Time",

    drawCallback: hideBusy,

    axes: {
        x: {
            axisLabelFormatter: function (d, gran) {
                return moment(d).tz("America/Los_Angeles").format('MMM DD');
            },
            valueFormatter: function (d) {
//                return new Date(d).toISOString()+"\n";
                return moment(d).tz("America/Los_Angeles").format('YYYY-MM-DD HH:mm:ss')+" (PST/PDT)";
            }
        }
    }

/*
    showRangeSelector: true,
    rangeSelectorHeight:30
*/
/*
    labelsDivStyles: { //ONLY works when not using labelsDiv
      'backgroundColor': 'rgba(200, 200, 255, 0.9)',
      'border': '1px solid black',
      'borderRadius': '10px',
      'boxShadow': '4px 4px 4px #888'
    },

//    strokeBorderWidth: 2, //SLOW
    ///SLOWS/kills site
    highlightSeriesOpts: {
      strokeWidth: 3,
      strokeBorderWidth: 1,
      highlightCircleSize: 5,
  //    drawPoints:true
    },
*/
};

/// Return the value passed from the URL
function getURLval(varname) {
  var query = window.location.search.split("?").pop();
  if (query.length == 0) { return ""; }
  var vars = query.split("&");
  var value = "";
  for (i=0;i<vars.length;i++)
  {
    var parts = vars[i].split("=");
    if (parts[0].toLowerCase() == varname) {
      value = parts[1];
      break;
    }
  }
  value = unescape(value); // Convert escape code
  value.replace(/\+/g," "); // Convert "+"s to " "s
  return value.toLowerCase();
}

/// Zoom "in" or "out" of dygraphs
function zoomInOut(dir){
  var w = dg.xAxisRange();
  var scale = w[1] - w[0];
  //console.log(scale, dg.xAxisRange(), dg.xAxisExtremes());
  if (dir == "out") {
    var wholeW = dg.xAxisExtremes();
    var wholeScale = wholeW[1] - wholeW[0];
    if (scale == wholeScale) {
      alert('Already zoomed to full extent. Range "Selected date range to see more data".');
    } else if (scale >= (wholeScale/2)) {
      reset();
    } else {
      zoom(scale/1000*2);
    }
  } else {
    zoom(scale/1000/2);
  }
}

///Look at the existing visibility of layers. 
///If its the same list of layers, keep the same visibility
function makeVisOptions(arr, TFarr) {
///TFarr is default.
  ///If the existing first value in the visible options is the same as the arr,
  ///use the existing visibility. May clip aux layers if appropriate
  if ($("#visOpts div label").first().text() == arr[0]) {
    //Loop through and match checked visibilities
//    console.log('USE existing VISIBILITY');
    var TFarr = [];
    $( 'input:checkbox', $('#visOpts')).each(function () {
      chTF = this.checked;
      TFarr.push(chTF);
    });
    TFarr = TFarr.slice(0,arr.length);
    if (arr.length > TFarr.length)  TFarr = TFarr.concat(Array(arr.length-TFarr.length).fill(false));
  } 
  ///If the visible options are a different length, create new labels/inputs
  if (($("#visOpts div").length != (arr.length)) || ($("#visOpts div label").first().text() != arr[0])) {
    $("#visOpts").html(''); //clear
    $.each(arr, function(i, v) {
      var ch = '';
      var cf = '';
      if (TFarr[i]) ch = 'checked="checked"';
      if (v == 'temperature') cf = '<form id="CFselSingle" style="display:inline-block; padding-left:10px"><label class="radio-inline"><input id="singleCF_C" name="singleCF" type="radio" value="c" onchange="changeCF(this.value)" checked />C&#176;</label><label class="radio-inline"><input id="singleCF_F" name="singleCF" type="radio" value="f" onchange="changeCF(this.value)"/>F&#176;</label></form>';
      $("#visOpts").append('<div><input '+ch+' id="vis_'+i
        +'" onchange="changeVis(this)" type="checkbox" value="" /> <label>'
        +v+'</label>'+cf+'</div>');
    });
  }
  return TFarr;
}

/// Change from celsius to fahrenheit and visa versa with data already existing in dygraphs
function changeCF(cf) {
$('#wholeBusy').show(); //NOT working!!!!
console.log("convert CF: ", cf);
  var fun;
  if (cf=='c') {
    fun = "F2C";
  } else if (cf=='f'){
    fun = "C2F";
  } else {console.log("no value!", cf);}
  if ($('#main_single').prop('checked')) {
//    console.log('each row, convert row[2]');
    $.each(dgData, function (i, dgRow) {
      dgData[i][2] = window[fun](dgRow[2]);
    });
    var lbls = dg.getLabels();
    lbls[2] = "temperature ("+$('input[name=singleCF]:checked', '#CFselSingle').val().toUpperCase()+")"
    dg.updateOptions({file:dgData, labels:lbls});
  } else {
    console.log('each row, convert row[1:]');
    $.each(dgData, function (i, dgRow) {
      var dgNewRow = [dgRow[0]];
      dgNewRow = dgNewRow.concat(dgRow.slice(1).map(window[fun]));
      dgData[i] = dgNewRow;
    });
    var yLbl = $('input[name=multiCF]:checked', '#CFselMulti').val().toUpperCase();
    dg.updateOptions({file: dgData, ylabel: yLbl});
  }
//  dg.updateOptions({file: dgData})
  hideBusy();
//console.log('hideBusy');
}

/// Calculate celsius to fahrenheit
function C2F(c){
  if (c == null) { return null; }
  else { return (c*9/5+32).toFixed(2); }
}

/// Calculate fahrenheit to celsius
function F2C(f) {
  if (f == null) { return null; }
  else { return ((f-32)*5/9).toFixed(2); }
}
//NOT USED???
function changeVis(el) {
  dg.setVisibility(parseInt(el.id.split('_')[1]), el.checked);
}

/// Sets the start range (#date1), with input date and subtracts span
function setStartRange(date, days) {
  var msSpan = days*24*3600*1000;
  var startDate = new Date(date.getTime() - msSpan);
  //$("#date1").val(startDate.toISOString().split('T')[0]);
  $("#date1").val(momentLA_Date(startDate));
}

/// Sets the end range (#date2), with input date and adds span
function setEndRange(date, days) {
  var msSpan = days*24*3600*1000;
  var endDate = new Date(date.getTime() + msSpan);
  //$("#date2").val(endDate.toISOString().split('T')[0]);
  $("#date2").val(momentLA_Date(endDate));
}

/// Sets date range (#date2 to now)
function move2Now() {
  var now = new Date();
  //var nowBuff = new Date(now.getTime() + (24*3600*1000));
///Set to tomorrow so it includes all of today
  //$("#date2").val(now.toISOString().split('T')[0]);
  $("#date2").val(momentLA_Date(now));
  setStartRange(now, $("#qryRangeDD").val()); 
  $('#fwd').addClass('disabled');
  $('#fwdEnd').addClass('disabled');
  //timelineType();
}

/// Station may not have recent data, so look at the most recent data that does have
function move2Latest() {
console.log('move2Latest:', sensorEndDate);
  //$("#date2").val(new Date(sensorEndDate).toISOString().split('T')[0]); //DAY AFTER
  setEndRange(new Date(sensorEndDate), 0);
  setStartRange(new Date(sensorEndDate), $("#qryRangeDD").val());
  $('#fwd').addClass('disabled');
  $('#fwdEnd').addClass('disabled');
  //timelineType();
}

/// Use the existing span in date range and shift back
function moveBack() {
  var d1 = new Date($("#date1").val())
  var d2 = new Date($("#date2").val())
  var span = (d2 - d1)/(24*3600*1000);
console.log("move back:", span, d1);
  $("#date2").val($("#date1").val());
  setStartRange(d1, span);
  //timelineType();
}

/// Use the existing span in date range and shift forward
function moveFwd() {
  var d1 = new Date($("#date1").val())
  var d2 = new Date($("#date2").val())
  var span = (d2 - d1)/(24*3600*1000);
console.log("move forward:", span);
  $("#date1").val($("#date2").val());
  //$("#date2").val(new Date(d2.getTime()+span).toISOString().split('T')[0]);
  setEndRange(d2, span);
  //timelineType();
}

/// For single station: move to start of sensor/station data
/// for multi stations: move to 06/15/2005, when most started collecting data
function move2Start() {
console.log('move2Start:', sensorStartDate);
if ($('#main_single').prop('checked')) {
  setStartRange(new Date(sensorStartDate), 0)
  setEndRange(new Date(sensorStartDate), $("#qryRangeDD").val());
} else {
  $("#date1").val("2005-06-15");
  setEndRange(new Date("06/15/2005"), $("#qryRangeDD").val());
}
  $('#backStart').addClass('disabled'); 
  $('#back').addClass('disabled');
  //timelineType();
}

/// Return string section to be used in URL request. 
/// Uses #date1 and #date2, which have a few restrictions.
/// Modify dates if they don't meet rescrictions.
function timeUrl(){
//console.log('in timeUrl (vals): start', $("#date1").val(), 'end:',  $("#date2").val());
  var d1 = new Date($("#date1").val()+" 00:00");
  var d2 = new Date($("#date2").val()+" 23:59:59.99");
//console.log('in timeUrl (dates): start', momentLA_Date(d1), 'end:', momentLA_Date(d2));

  ///Check end is after start
  if (d1 > d2) {
    alert("start date is later than end date, swapping dates");
    var tmp = $("#date1").val();
    $("#date1").val($("#date2").val());
    $("#date2").val(tmp);
    return timeUrl();
  }

  if ($('#main_single').prop('checked')) {
    ///If before date of sensor, move date range to the start date of the station
    if (d1.getTime() < new Date(sensorStartDate).setHours(0,0,0,0)) { 
      move2Start();
      return timeUrl();
    } else if (d1 > new Date(sensorStartDate)) {
       $('#backStart').removeClass('disabled');
       $('#back').removeClass('disabled');
    }
    ///If past date of sensor, move date range to latest data for station
    if (d1 > new Date(sensorEndDate)) {
alert('Currently the latest data available for this station is :'+sensorEndDate+'. Adjusting date range');
      move2Latest();
      return timeUrl();
    } else if (d2 < new Date(sensorEndDate)) {
      $('#fwd').removeClass('disabled');
      $('#fwdEnd').removeClass('disabled');
    }
  ///For Multi Stations
  } else {
    ///Don't allow date range before June 2005
    if (d1 < new Date("06/15/2005")) {
      alert('No data previous to June 2005. Adjusting date range');
      move2Start();
      return timeUrl();
    }  
    if (d1 > new Date("06/15/2005")) {
      $('#backStart').removeClass('disabled');
      $('#back').removeClass('disabled');
    }
    if (d2 < new Date()) {
      $('#fwd').removeClass('disabled');
      $('#fwdEnd').removeClass('disabled');
    }
  }

/*
  ///Don't let dates be before 2005
  if ((d1 < new Date("06/01/2005")) || (d2 < new Date("06/01/2005"))) {
    alert("No earlier data. Setting date range");
    if ($('#main_single').prop('checked')) {
      move2Start();
    } else {
      ///Set #date1 and #date2!!!!
      $("#date1").val() = "06/01/2005";
      $("#date2").val() = "01/01/2006";
      timeUrl();
    }
  }
*/
  ///Date range can't only consist of future values
  if (d1 > new Date()) {
    alert('Can not set date range with future dates. Adjusting date range.'); 
    move2Now();
  }

  var span = (d2 - d1)/(24*3600*1000);
  console.log("span (days)", span);
  ///Check span, if too big, set to 1 year
  if (span > 367) {
    alert("Range has been limited to one year for graph usability. To see/get more data, use the Access Data links below.");
    var prevYr = new Date(d2.getTime() - (366*24*3600*1000));
    $("#date1").val(momentLA_Date(prevYr));
    return timeUrl();
  }
  
//  return '&time>='+$("#date1").val()+'T00:00:00.000Z&time<'+$("#date2").val()+'T23:59:59.99Z&orderBy("time")'
//  var d1str = new Date($("#date1").val()+" 00:00").toISOString();
//  var d2str = new Date($("#date2").val()+" 23:59:59.99").toISOString();
  var d1str = moment($('#date1').val()).utc().toISOString();
  var d2str = moment($('#date2').val()+" 23:59:59").utc().toISOString()
  return '&time>='+d1str+'&time<'+d2str+'&orderBy("time")';
}

///Returns the url used for "Compare Stations" 
function getStationsUrl(ext) {
  //attr = $("#attr").val();
  var url = baseERDDAP;
  url += ext+'?station,time,'+attr
  
  if (($("#onlyQC").prop('checked')) && (flagsArr.indexOf(attr) > -1)) {
    url += '&'+attr+'_flagPrimary=1';
  }
  //url += appendTime;
  url += timeUrl();
  return url;
}

///Returns the url used for "Single Station"
function getAttrsUrl(ext) {
  var url = baseERDDAP;
  url += ext+'?time,' //.csv0
  var varArr = [];
  $.each(flagsArr, function(a, at) {
    varArr = varArr.concat(at, at+'_flagPrimary');
    if (!($("#onlyQC").prop('checked'))) varArr = varArr.concat(at+'_flagSecondary');
  });
  if ($("#sensorData").prop('checked')) {
    varArr = varArr.concat(sensorsArr);
  } 
  url += varArr.join(',')
  url += '&station="'+sensor+'"';
  //url += appendTime;
  var timeStr = timeUrl();
//  console.log("returned timeUrl", timeStr);
  url += timeStr;
  return url;
}

/// Return link to ERDDAP url of query used
function getErddapUrl(ext) {
  if ($('#main_multi').prop('checked')) {
    return getStationsUrl(ext);
  } else if ($('#main_single').prop('checked')) {
    return getAttrsUrl(ext);
  } else {
    alert('error retrieving selection');
  }
}

///Main function for "Compare Stations - single attribute"
function allStations(data) {
  ///ERDDAP data comes in columns: Station, Date, Attribute value
  var staDict = {};
 // console.log(data["table"]["columnNames"]);
  ///Use time as INDEX, then station as KEY, attribute value as VALUE
  $.each(data["table"]["rows"], function (i, row) {
    if (!(row[1] in staDict)) staDict[row[1]] = {};
    if ((attr == 'temperature') && ($('#multiCF_F').prop('checked'))) {
      staDict[row[1]][row[0]] = C2F(row[2]);
    } else {
      staDict[row[1]][row[0]] = row[2];
    }
  });
  dgData = [];
  ///Make data MATRIX with a column for date and for each station's value
  /// for a single particular attribute
  $.each(staDict, function(date, obj) {
    dateRow = [new Date(date)]; // = [date];
    //$.each(staArr, function(s, sta) {
    $.each(stationsMeta, function(sta, staObj) {
      if (sta in obj) {
        dateRow.push(obj[sta])
      } else {
        dateRow.push(null);
      }
    });
    dgData.push(dateRow);
  });
 // console.log(dgData);
  colorArr = [];
  $.each(stationsMeta, function (s, v){ 
    colorArr.push(v['border-color']);
  });

  ///Y axis label
  if (attr == 'temperature') {
   var yLbl = $('input[name=multiCF]:checked', '#CFselMulti').val().toUpperCase();
  } else {
   var yLbl = data["table"]["columnNames"][2];
  }

  var visArr = makeVisOptions(Object.keys(stationsMeta), Array(Object.keys(stationsMeta).length).fill(true));
  var dgOpts = $.extend({
    labels: ['date'].concat(Object.keys(stationsMeta)),
    visibility: visArr,
    colors: colorArr,
    ylabel: yLbl,
    connectSeparatedPoints: true,
  }, defDgOpts);
  //Array.apply(null, Array(4)).map(function(){return true})
  $('.show-hide').show();
  dg = new Dygraph( document.getElementById("chart-container"), dgData, dgOpts);
  //delete data; //improve memory? Keep for changing units???
}

///Main function for "Single Station"
///Assumes "time" is first column in returned data
function singleStation(data) {
  var staDict = {};
  var useArr, visArr;
  var anns = [];
  cols = data["table"]["columnNames"];

  useArr = ["time"].concat(flagsArr);
  if ($("#sensorData").prop('checked')) useArr = useArr.concat(sensorsArr);
  var visArr = makeVisOptions(useArr.slice(1), [true, false, true].concat(Array(useArr.length-1-    3).fill(false)));

  dgData = [];
  //Make data MATRIX
  //IF showing only QC data, process returned data
  if ($("#onlyQC").prop('checked')) {
    $('.annLine').hide();
    //Loop and look for flags==1 for appropriate attributes
    $.each(data["table"]["rows"], function (i, row) {
      // var dateStr = row[cols.indexOf("time")];
      var dgRow = [new Date(row[0])];
      if ($('#singleCF_F').prop('checked')) {
        tempIndex = cols.indexOf("temperature");
        row[tempIndex] = C2F(row[tempIndex]);
      }
      $.each(flagsArr, function(a, at) {
        atF = at+"_flagPrimary"
        ///make row of only attributes where their flag == 1
        if (row[cols.indexOf(atF)] == 1) {
          dgRow.push(row[cols.indexOf(at)]);
        } else {
          dgRow.push(null);
        }
      });
      if ($("#sensorData").prop('checked')) {
        $.each(sensorsArr, function(s, snr) { 
          dgRow.push(row[cols.indexOf(snr)]);
        });
      }
      dgData.push(dgRow);
    });
  //NO QC
  } else {
    $('.annLine').show();
    ///Show all data, except flags, as series. 
    ///If sensor data is in there is will be shown.
    $.each(data["table"]["rows"], function (j, row) {
       //var dgRow = [new Date(row[0])];
       //dgRow = dgRow.concat(row.slice(1));
       var dgRow = [];
       $.each(cols, function(i, attrName) {
         //only non-flag attributes
         if (attrName.indexOf('_flag') == -1) {
           if (attrName == "time") {
             dgRow.push(new Date(row[i]));
           } else {
             var attrVal;
             if ((attrName == "temperature") && ($('#singleCF_F').prop('checked'))) {
               attrVal = C2F(row[i]);
             } else {
               attrVal = row[i];
             }
             dgRow.push(attrVal);
             //only do for attributes with flags
             if (flagsArr.indexOf(attrName) > -1) {
               var flPriVal = row[cols.indexOf(attrName+'_flagPrimary')];
               //Annotate only bad primary flags
               if (flPriVal != 1) { //if (flPriVal == 4)
                 var flSecVal = row[cols.indexOf(attrName+'_flagSecondary')];
                 var ann = {
                   series: attrName,
                   x: Date.parse(row[0]),
                   cssClass: 'ann',
                   width: 12,
                   height: 17 , 
                   attachAtBottom: $('#annLine').prop('checked'),
                   shortText: flPriVal.toString(),
                   text: "Val: "+attrVal.toString()+
                        "\nPrimary flag: "+flPriVal.toString()+
                        "\nSecondary flag: "+flSecVal.toString()
                 };
                 anns.push(ann);
               }
             }
           }
         }
       });
       dgData.push(dgRow);
    }); 
    console.log('number of annotations:', anns.length);
    //dg.setAnnotations(anns);
  }
    ///by default just show pressure(col 1) and chlorophyll(col 3)
    ///attach arr of false values for remaining arr length 
  colorArr = ['#0DD', '#D0D', '#0D0', '#F80'];
  if ($("#sensorData").prop('checked')) colorArr = colorArr.concat(['#069', '#600', '#773', '#636', '#555', '#888', '#BBB']);
//console.log("labels", useArr, visArr);

  ///For legend, add units to labels
  lbls = [];
  $.each(useArr, function(i, v) {
    if (v == "temperature") {
      var unit = $('input[name=singleCF]:checked', '#CFselSingle').val().toUpperCase()
    } else {
      var unitIndex = data["table"]["columnNames"].indexOf(v);
      var unit = data["table"]["columnUnits"][unitIndex]
    }
    lbls.push(v+" ("+unit+")");
  });

  var dgOpts = $.extend({
    visibility: visArr,
    labels: lbls, //labels: useArr,
    colors: colorArr
  }, defDgOpts);

  $('.show-hide').show();
  //dg = new Dygraph( document.getElementById("chart-container"), url, dgOpts);
  dg = new Dygraph( document.getElementById("chart-container"), dgData, dgOpts);
  dg.setAnnotations(anns);
}

///Shift annotations from bottom to point and visa versa
function shiftAnns() {
  var anns = dg.annotations();
//console.log("shiftAnns", $('#annLine').prop('checked'));
  for (var i = 0; i < anns.length; i++) {
    anns[i].attachAtBottom = $('#annLine').prop('checked');
  }
  dg.setAnnotations(anns);
}

///get JSON from ERDDAP, pass function name to be used
function getJsonData(url, funName) {
//    console.log('getJsonData(url):', url);
    $('.annLine').hide();
    $.ajax({
      url: url,
      dataType: 'jsonp',
      jsonp: '.jsonp',
      cache: 'true',
 //     jsonpCallback: funName,
      // crossDomain: true,
  success: function(data) {
 //   console.log(data);
    window[funName](data);
  },
      error:function(){
        alert("Error retrieving data. Try different parameters or reload.");
        $('.show-hide').hide();
        hideBusy();
      }
// }).done(function() {
// console.log('getJsonData done');
// }).fail(function(d, textStatus, error) {
// console.log("getJsonData (fail) Error: ", error);
// }).always(function() {
// console.log("getJsonData always");
    });
}

/// Used to get the start and end date range of a single station/sensor
function getStationDate(url, callbackFun) {
   req = $.ajax({
        url: url,
        dataType: 'jsonp',
        jsonp: '.jsonp',
        cache: 'true',
//        async: false,
//        jsonpCallback: callbackFun,
        success: function(data) {
          window[callbackFun](data);
        },
        error:function(){ console.log("Error: ", callbackFun); }
   });
   return req
}

/// Set the START date info label of a single station/sensor
function setStationStartDate(minData) {
   sensorStartDate = minData["table"]["rows"][0][1];
  // $('#startDateUTC').text(sensorStartDate);
   $('#startDateLocalAll').text(jsMoment(sensorStartDate, 'pac', 'L'));
}
/// Set the END date info label of a single station/sensor
function setStationEndDate(maxData) {
   sensorEndDate = maxData["table"]["rows"][0][1];
  // $('#endDateUTC').text(sensorEndDate);
   $('#endDateLocalAll').text(jsMoment(sensorEndDate, 'pac', 'L'));
}

///Set the start and end date info label of a single station/sensor BEFORE getting data
function setStation() {
///global variables: sensorStartDate, sensorEndDate
  baseDataDateUrl = baseJSON+'?station,time&station="'
  startDataDateUrl = baseDataDateUrl+sensor+'"&orderByMin(%22time%22)';
  endDataDateUrl = baseDataDateUrl+sensor+'"&orderByMax(%22time%22)';

   $.when(getStationDate(startDataDateUrl, 'setStationStartDate'), 
          getStationDate(endDataDateUrl, 'setStationEndDate')).then(function(one, two) 
   {
     //graphCsv(getAttrsUrl('.csvp'))
     getJsonData(getAttrsUrl('.json'), "singleStation");
   });
}

//toggle between shortcuts (1w, 1m, 3m, 6m, 1yr) and dates (start and end)
function toggleRangeType(){
  if ($("#rangeOpts").is(":visible")) {
    $('#rangeOpts').hide();
    $('#date1').hide();
    $('#date2').hide();
    $('#rangeCal').show();
    $('#qryRange').show();
  } else {
    $('#rangeCal').hide();
    $('#qryRange').hide();
    $('#rangeOpts').show();
    $('#date1').show();
    $('#date2').show();
  }
}

function jsMoment(utcTime, tz, format) {
  var tz = (typeof tz === 'undefined') ? 'pac' : tz;
  var format = (typeof format === 'undefined') ? null : format;

  if (tz == 'utc') {
    if (format == 'normal') format = 'MM/DD/YYYY HH:mm:ss';
    return moment(utcTime).utc().format(format);
  } else {
    if (format == 'normal') format = 'MM/DD/YYYY HH:mm:ss Z (ddd)';
    return moment(utcTime).tz("America/Los_Angeles").format(format);
  }
}

function momentLA_Date(d) {
  return moment(d).tz("America/Los_Angeles").format('YYYY-MM-DD');
}

///Function for when attribute is changed on multi stations
function chgAttrDD(selAttr) {
  attr = selAttr;
  $('#attrDDSel').text( $('#qr_'+attr).text() );
  $('#attrDDSel').attr('title', attr);
  if (attr == 'temperature') {
    $('#CFselMulti').show();
  } else {
    $('#CFselMulti').hide();
  }
}

///When the user enters a date in the start/end date range, 
///turn the reload button green to entice to user to press it 
///when they're done/ready. 
///Auto updating graph after manual input leads to premature loading 
///(since they likely update both)
function manualDate() {
  $('#reload').removeClass('btn-primary');
  $('#reload').addClass('btn-success');
}

///When the "refresh"/reload button is pressed reload the graph
function reloadBtn() {
  $('#reload').removeClass('btn-success');
  $('#reload').addClass('btn-primary');
  timelineType();
}

///MAIN start function, both initially and called throughout.
function timelineType() {
  $('#wholeBusy').show();
  $('#container').html('');
  if ((dg) && (dg.file_)) dg.destroy();
  if ($('#main_multi').prop('checked')) {
    $('.singleStaOnly').hide();
    $('.multiStasOnly').show();
    $('#sub_multi').show();
    if (flagsArr.indexOf(attr) > -1) {
      $(".onlyQC").show();
    } else {
      $(".onlyQC").hide();
    }
// console.log(getStationsUrl('.json'));
    getJsonData(getStationsUrl('.json'), "allStations");
  } else if ($('#main_single').prop('checked')) {
    attrCharts = {};
    console.log('Single Station');
    $('#sub_multi').hide();
    $('.singleStaOnly').show();
    $('.multiStasOnly').hide();
    $(".onlyQC").show();
 //   sensor = $('#staSel > .btn.active > input').val();
    console.log("#staSel active:", $('#staSel > .btn.active > input').val());
    setStation();
  } else { ///Hide everything
    $('.singleStaOnly').hide();
    $('.multiStasOnly').hide();
    $('.show-hide').hide();
    $('#sub_multi').hide();
    hideBusy();
  }
//  $('#wholeBusy').hide();
}
function hideBusy() {
  $('#wholeBusy').hide();
}
//~~~~~~~~~~~~~~~~~~~~ onload ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
$(function () {
  busy = $('<div id="wholeBusy" class="busy">\
    <div class="innerBusy">\
      <img src="http://neocodev.ucsd.edu/playground/dg/big_spinner.gif"><br>\
      <span class="procTxt">Making chart...</span>\
    </div>\
  </div>');
  $('body').prepend(busy);

  ///A preset dropdown timespan is selected
  $("#qryRange").on("click", "li a", function(event) {
    var selSpan = this.id.split('_')[1];
 console.log('query dropdown', $(this).text(), selSpan);
    $("#qryRangeDD").html($(this).text()+'<span class="caret"></span>');
    if ($("#qryRangeDD").val() != selSpan) {
      setStartRange(new Date($('#date2').val()), selSpan); 
      timelineType();
      $("#qryRangeDD").val(this.id.split('_')[1]);
    }
  });

  ///Changed attribute radio/buttons under "Compare stations" option
  $("#qryAttr").on("click", "li a", function(event) {
    // attr = this.id.split('_')[1];
    // $('#attrDDSel').text( $(this).text() );
    // $('#attrDDSel').attr('title', attr);
    chgAttrDD(this.id.split('_')[1]);
    timelineType();
  });

  //timelineType();
  toggleRangeType();
  url_main = getURLval("main");
  url_station = getURLval("station");
  url_attr = getURLval("attr");
  console.log("url inputs:", url_main, url_station, url_attr)

  ///Preset page according to url input "main=[...]"
  if ((url_main == "single") || (url_main == "multi")) {
    $("#main_"+url_main).attr("checked", true)
  }

  ///Preset page according to url input "station=[...]"
  if (stationsMeta.hasOwnProperty(url_station)) {
    $('#staSel > .btn.active').removeClass('active');
    $('#timeline_'+url_station).addClass('active');
    //checked??
  } 
  sensor = $('#staSel > .btn.active > input').val();

  ///Preset page according to url input "attr=[...]"
  if (attrsArr.indexOf(url_attr) > -1) {
    chgAttrDD(url_attr);
  } else {
    //default attribute
    attr = $("#attrDDSel").attr('title');
  }
  move2Now();
  timelineType();
});

//~~~~~~~~~~Copied from....
var desired_range = null, animate;
function approach_range() {
  if (!desired_range) return;
  // go halfway there
  var range = dg.xAxisRange();
  if (Math.abs(desired_range[0] - range[0]) < 60 &&
      Math.abs(desired_range[1] - range[1]) < 60) {
    dg.updateOptions({dateWindow: desired_range});
    // (do not set another timeout.)
  } else {
    var new_range;
    new_range = [0.5 * (desired_range[0] + range[0]),
                 0.5 * (desired_range[1] + range[1])];
    dg.updateOptions({dateWindow: new_range});
    animate();
  }
}
animate = function() {
  setTimeout(approach_range, 20);
};

var zoom = function(res) {
  var w = dg.xAxisRange();
//  desired_range = [ w[0], w[0] + res * 1000 ]; //zooms in on beginning
desired_range = [ w[1]-(res*1000), w[1]]; //zooms in on end
  animate();
};

var reset = function() {
  var orig_range = [dg.rawData_[0][0],dg.rawData_[dg.rawData_.length - 1][0].valueOf()];
  desired_range = orig_range;
  animate();
// console.log('reset', dg.xAxisRange());
};

var pan = function(dir) {
  var w = dg.xAxisRange();
  var scale = w[1] - w[0];
  var amount = scale * 0.25 * dir;
  desired_range = [ w[0] + amount, w[1] + amount ];
  animate();
};
