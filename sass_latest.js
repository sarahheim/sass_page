//Author: Sarah Heim
//~~~~~~~~~~~~~~~~ Global variables ~~~~~~~~~~~~~~~~~~~~~~~~
var chart;
var attr;
var sensor
var sensorStartDate
var sensorEndDate;
var baseERDDAP = 'http://sccoos.org/erddap/tabledap/autoss';
var baseJSON = baseERDDAP+'.json';
var flagsArr = ["temperature", "pressure", "chlorophyll", "salinity"];
//var staAbbr = ['UCSB', 'UCLA', 'UCI', 'UCSD'];
var staAbbr = ['stearns_wharf', 'santa_monica_pier', 'newport_pier', 'scripps_pier'];
var attrsArr = flagsArr.concat(['conductivity', 'sigmat', 'diagnosticVoltage', 'currentDraw', 'aux1', 'aux3', 'aux4']);
psFlagsArr = [];
$.each(flagsArr, function(f, fAttr) {
  psFlagsArr.push(fAttr+'_flagPrimary');
  psFlagsArr.push(fAttr+'_flagSecondary');
});
var allArr = attrsArr.concat(psFlagsArr);

var stationsMeta = {
/*
//Bright colors
  'UCSB': { 'border-color':'#7700FF', 'fill-color':'#CCCCFF'},
  'UCLA': { 'border-color':'#EEEE00', 'fill-color':'#FFFFAA'},
  'UCI': { 'border-color':'#00FFFF', 'fill-color':'#CCFFFF'},
  'UCSD': { 'border-color':'#FF00FF', 'fill-color':'#FFCCFF'}
*/
//Dark colors
//UCLA border #909, fill #FCF},
  'stearns_wharf': { 'name': 'Stearns Wharf', 'border-color':'#099', 'fill-color':'#CFF'},
  'santa_monica_pier': { 'name': 'Santa Monica Pier', 'border-color':'#333', 'fill-color':'#DDD'},
  'newport_pier':  { 'name': 'Newport Pier', 'border-color':'#990', 'fill-color':'#FFA'},
  'scripps_pier': { 'name': 'Scripps Pier', 'border-color':'#409', 'fill-color':'#CCF'}
};

//~~~~~~~~~~~~~~~~~~~~ Highcharts timeline~~~~~~~~~~~~~~~~~~~~~~~~~~~
///Highchart's tooltip show flag info (QC not checked)
function tooltipFlags() {
	// ' ' + Highcharts.dateFormat('%m/%d/%y %H:%M:%S', new Date(this.x)) +
	return stationsMeta[sensor]['name']+'<br>'+
        '<b>'+jsMoment(this.x, 'pac', 'normal')+' Pacific Time</b><br>'+
//ISO '%Y-%m-%dT%H:%M:%SZ'
        Highcharts.dateFormat('%m/%d/%Y %H:%M:%S', new Date(this.x))+' (UTC)'+
        '<br><b>' + this.series.name +': '+this.y+' '+this.unit+//{this.y:,.2f}+': </b>'+
	'<br/>primary flag: '+this.flag1+
	'<br/>secondary flag: '+this.flag2;
}

///No flag in Highchart's tooltip (QC checked)
function tooltipNoFlags() {
	return stationsMeta[sensor]['name']+'<br>'+
        '<b>'+jsMoment(this.x, 'pac', 'normal')+' Pacific Time</b><br>'+
//ISO '%Y-%m-%dT%H:%M:%SZ'
        Highcharts.dateFormat('%m/%d/%Y %H:%M:%S', new Date(this.x))+' (UTC)'+
        '<br><b>' + this.series.name +': </b>'+this.y+' '+this.unit;
}

///Makes latest data chart with returned data from .ajax of selected station and attribute
function functionName(data){
	var maxRange = 1000 * 3600 * 24 * 14;
	var chartOptions = {
		chart: { renderTo: 'container' },
		loading: {
			style: { opacity: 0.8 },
			labelStyle: { fontSize: '300%' }
		},
		xAxis: {
			type: 'datetime',
			ordinal: false,
			labels : {
				format: '{value:%m-%d %H:%M}',
				rotation: 20
			}
		},
	    yAxis: {
	    	labels: { format: "" },
	    	title: {text: "" }
	    },
	    rangeSelector: {
	        buttons: [{ type : 'hour', count : 6, text : '6h'
	        }, { type : 'hour', count : 12, text : '12h'
	        }, { type: 'day', count: 1, text: '1d'
	        }, { type: 'day', count: 3, text: '3d'
	        }, { type: 'week', count: 1, text: '1w'
	        //}, { type: 'month', count: 1, text: '1m'
	        // }, { type: 'month', count: 6, text: '6m'
	        // }, { type: 'year', count: 1, text: '1y'
	        // }, { type: 'all', text: 'All'
	        }],
	        selected: 4,
	        inputEnabled: false
	    },
//            navigator: { enabled: false },
	    scrollbar: { enabled: false
  //              , liveRedraw:false
            },
	    // title : { text : 'Title' },
	    plotOptions: {
                  line: {
                      pointInterval: 60 * 1000,
                      gapSize: 30
                  },
			series: {

                                lineWidth: 1,
                                marker: {
                                    enabled: true,
                                    radius: 2
                                },

				// dataGrouping: false, //Not needed here? Only in (root) series?
				tooltip: {
                                        // xDateFormat: '%A %m-%d-%Y %H:%M'
                                        headerFormat: ''
					// pointFormatter: tooltipFlags
				},
			   	turboThreshold: 0 //CRUCIAL for more than 1000 points!!!!
			}
	    },
	    series : [{
	    	dataGrouping: {enabled: false} //NEEDED or dataGrouping doesn't pass custom attributes/properties
//		, lineWidth: 0
	    	// , events : {
	    		// afterAnimate : function () {
	    			// console.log('HIDE loading');
	    		// }
	    	// }
	    	// , point: {
	    		// events: {
	    			// mouseOver: function () {
	    				// console.log(this);
	    			// }
	    		// }
	    	// }
	    }]
	};
	// console.log(data.table.rows.length); //same as data["table"]["rows"].length
    dataDict = [];
    min = data["table"]["rows"][0][2];
    max = data["table"]["rows"][0][2];
    $.each(data["table"]["rows"], function (i, item) { //preference if bringing multiple columns
    	// item[0] = new Date(item[0]).getTime();
    	/// get min and max from data to be used to set yAxis range
    	if (item[2] < min) { min = item[2] }
    	if (item[2] > max) { max = item[2] }
    	row = {
    		x: new Date(item[1]).getTime(),
    		y: item[2],
                unit: data["table"]['columnUnits'][2]
    		// flag1: item[3],
    		// flag2: item[4]
    		};
        ///"store" flag data to be used for the tooltip
    	if ((!$("#onlyQC").prop('checked')) && (flagsArr.indexOf(attr) > -1)) {
    		row.flag1 = item[3]
    		row.flag2 = item[4]
    		if (row.flag1 != 1) { row.color = '#FF0000'}
    	}
    	dataDict.push(row);
    });
    // console.log(data["table"]["rows"][0]);
    // console.log(dataDict.length, min, max);
    if (chart) chart.destroy();
    chartOptions.series[0].data = dataDict;
    chartOptions.series[0].name = attr; // data["table"]["columnNames"][2];
    chartOptions.yAxis.title.text = attr+' ('+data["table"]["columnUnits"][2]+')'; //data["table"]["columnNames"][2];
    //chartOptions.yAxis.labels.format = '{value} '+data["table"]["columnUnits"][2];
    chartOptions.yAxis.labels.format = '{value}';

    if ((!$("#onlyQC").prop('checked')) && (flagsArr.indexOf(attr) > -1)) {
    	chartOptions.plotOptions.series.tooltip.pointFormatter = tooltipFlags;
    } else {
    	chartOptions.plotOptions.series.tooltip.pointFormatter = tooltipNoFlags;
    }
    // $('#container').highcharts('StockChart', chartOptions);
    chart = new Highcharts.StockChart(chartOptions);
    chart.yAxis[0].setExtremes(min, max);
    // chart.series[0].dataGrouping.enabled = false;
}

///get (station/attribute) URL for data put in Hichcharts
function getDataUrl(){
    //var now = new Date().getTime();
    var lastDT = new Date(sensorEndDate).getTime();
    //console.log(typeof(now), now, typeof(sensorEndDate), sensorEndDate);
    var diff = 1000*3600*24*7;
    //var startSpan = new Date(now-diff);
    var startSpan = new Date(lastDT-diff);
    //console.log(startSpan.toISOString(), startSpan);
//    var startTxt = "&time>="+startSpan.getFullYear().toString()+"-"+("0" + (startSpan.getMonth() + 1)).slice(-2)+"-01T00:00:00Z"; //older.getMonth()+1;
    var startTxt = "&time>="+startSpan.toISOString();

    // jsonUrl = baseJSON+'?station,time,'+attr;
    // csvUrl = baseERDDAP+'.csv'+'?station,time,'+attr;
    urlEnd = '?station,time,'+attr;
    if ($("#onlyQC").prop('checked')) {
         // jsonUrl += '&'+attr+'_flagPrimary=1';
         if (flagsArr.indexOf(attr) > -1) urlEnd  += '&'+attr+'_flagPrimary=1';
    } else if (flagsArr.indexOf(attr) > -1) {
         // jsonUrl += ','+attr+'_flagPrimary'+','+attr+'_flagSecondary';
         urlEnd  += ','+attr+'_flagPrimary'+','+attr+'_flagSecondary';
    }
    //htmlUrl = baseERDDAP+'.html'+urlEnd+'&station="'+sensor+'"'+'&orderBy(%22time%22)';
    // jsonUrl += '&station="'+sensor+'"'+startTxt+'&orderBy(%22time%22)';
    urlEnd += '&station="'+sensor+'"'+startTxt+'&orderBy(%22time%22)';
    jsonUrl = baseJSON+urlEnd;
    csvUrl  = baseERDDAP+'.csvp'+urlEnd

    $('#getCSV').attr('href', csvUrl);
    //$('#access').attr('href', htmlUrl);
    return jsonUrl;
}

///get (station/attribute) data put in Hichcharts
function getData() {
    attr = $("#attr").val();
    $('#compare').attr('href', './timeline/?main=multi&attr='+attr);
    if (chart) chart.showLoading();
	//$('#loader').show();
    url = getDataUrl();
    // console.log('getData(url):', url);
    $.ajax({
        url: url,
	    dataType: 'jsonp',
	    jsonp: '.jsonp',
	    cache: 'true',
	//    jsonpCallback: 'functionName',
        // crossDomain: true,
        success: function(dataWeGotViaJsonp){
          window['functionName'](dataWeGotViaJsonp);
          chart.hideLoading();
          $('#loader').hide();
          // setStation();
        },
		error:function(){
			alert("Error");
		}
    });
}

function getStationDate(url, callbackFun) {
   req = $.ajax({
        url: url,
        dataType: 'jsonp',
        jsonp: '.jsonp',
        cache: 'true',
//        async: false,
//        jsonpCallback: callbackFun,
        success: function(data){
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
   $('#startDateLocal').text(jsMoment(sensorStartDate, 'pac', 'L'));
}
/// Set the END date info label of a single station/sensor
function setStationEndDate(maxData) {
   sensorEndDate = maxData["table"]["rows"][0][1];
   $('#endDateUTC').text(sensorEndDate);
   $('#endDateLocal').text(jsMoment(sensorEndDate, 'pac', 'L'));
}

/// Set the END date info label of a single station/sensor
function setStation() {
///global variables: sensorStartDate, sensorEndDate
   baseDataDateUrl = baseJSON+'?station,time&station="'
   startDataDateUrl = baseDataDateUrl+sensor+'"&orderByMin(%22time%22)';
   endDataDateUrl = baseDataDateUrl+sensor+'"&orderByMax(%22time%22)';

   //$('#access').attr('href', baseERDDAP+'.html');
   $('#access').attr('href', './timeline/?main=single&station='+sensor);

   $.when(getStationDate(startDataDateUrl, 'setStationStartDate'),
          getStationDate(endDataDateUrl, 'setStationEndDate')).then(function(one, two)
   {
     getData();
   });
}

//~~~~~~~~~~~~~~~~~~~~ Latest data ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///create boostrap well(box) for each station of their latest attribute values
function createLatestWells() {
   $.each(staAbbr, function(j, sta) {
     dataId = sta+"_data"
     //console.log(sta);
/*
     var staDiv = document.createElement("div");
     staDiv.id = sta+'_well'
     staDiv.className = "col-sm-6 col-md-3 well well-lg";
     staDiv.innerHTML = '<h3>'+sta+'</h3><p id="'+dataId+'"></p>';
*/
     var staDiv = $('<div id="'+sta+'_well'+'" class="col-sm-6 col-md-3 well well-lg"></div>');
     //setting well color in getStationStyle()
//     staDiv.html('<h3>'+sta+'</h3><p id="'+dataId+'"></p>');
     staDiv.html('<h4><a target="_blank" href="./timeline/?main=single&station='+sta+'">'+stationsMeta[sta]['name']+'</a></h4>'+
                   '<span id="'+dataId+'_time"></span><table id="'+
                    dataId+'" class="table table-sm table-hover"></table>');


     $("#latest").append(staDiv);

//     latestUrl = baseJSON+'?station,time,'+attrsArr.join(',')+'&station="'+sta+'"&orderByMax(%22time%22)';
     latestUrl = baseJSON+'?station,time,'+allArr.join(',')+'&station="'+sta+'"&orderByMax(%22time%22)';
     // console.log(latestUrl);

     $.ajax({
          url: latestUrl,
          dataType: 'jsonp',
          jsonp: '.jsonp',
          cache: 'true',
          //jsonpCallback: 'latestDataFun',
          success: function(returnedData){
            latestDataFun(returnedData);
          },
          error:function(xhr, status, error){
            console.log("ERROR:", sta);
            console.log(xhr.responseText, status, error);
            return false;
          }
     });
   });
}

///Callback from the .ajax data, for each station's well.
///Creates table of the returned data
function latestDataFun(latest) { //data is passed
  var colNames = latest["table"]["columnNames"];
  var latestArr = latest["table"]["rows"];
  var sta = latest["table"]["rows"][0][0];
  var dataId = sta+"_data"
  var now = new Date().getTime();
  var staDic = {};
  //turn returned data (in an array) into a dictionary
  $.each(colNames, function(c, colName) {
    staDic[colName] = {};
    staDic[colName]['value'] = latestArr[0][c];
    staDic[colName]['unit'] = latest["table"]["columnUnits"][c];
  });
  //make time line/span
  var latestDT = new Date(staDic['time']['value']).getTime();
  var diffNowMins = (now - latestDT)/ (60*1000);
  if (diffNowMins < 30) {
    // timeClass = 'label label-success';
    timeClass = '';
    timeIcon = '';
  } else {
    // timeClass = 'label label-danger';
    timeClass = 'text-danger';
    timeIcon = '<span class="glyphicon glyphicon-time" title="< 30 mins old"></span>';
  }

  //var dataSpan = document.createElement("span");
  //dataSpan.innerHTML
  $('#'+dataId+'_time').html('<span class="'+timeClass+'"><b>'+
     jsMoment(staDic['time']['value'], 'pac', 'normal')+
     ' Pacific Time '+timeIcon+'</b></span><br><span class="'+timeClass+'">'+
     jsMoment(staDic['time']['value'], 'utc', 'normal')+' UTC</span>');
//  $('#'+sta+'_well').append(dataSpan);

/*
  var tableHead = document.createElement("thead");
  tableHead.innerHTML = '<tr><th>Pacific Time</th><th>'+jsMoment(staDic['time']['value'], 'pac', 'normal')+
                      '</th></tr><tr><th>UTC</th><th>'+jsMoment(staDic['time']['value'], 'utc', 'normal')+'</th></tr>'
  $('#'+dataId).append(tableHead);
*/

  tableBody = $('#'+dataId).append(document.createElement("tbody"));

  $.each(attrsArr , function(a, attr) {
    valFx = staDic[attr]['value'].toFixed(2);
    valTxt = valFx +' '+ staDic[attr]['unit']
    //ATTRIBUTE HAS FLAG, add icon if flag is not "good"
    if (flagsArr.indexOf(attr) > -1) {
      pFlag = staDic[attr+'_flagPrimary']['value']
      flagTxt = '(FLAGS: '+pFlag+', '+staDic[attr+'_flagSecondary']['value']+')'
      if (pFlag != 1) { icon = '<span class="glyphicon glyphicon-exclamation-sign" title="'+flagTxt+'"></span>' }
      else { icon = '' }
    } else { icon = ''}

    var tableRow = document.createElement("tr");
    tableRow.setAttribute('id', 'latestSpan_'+sta+'_'+attr);
    if (flagsArr.indexOf(attr) == -1) tableRow.setAttribute('class', 'collapse out');
    //Show temperature as °C & °F
    if (attr == 'temperature') {
      dC = staDic[attr]['value'];
      dF = (dC * 9 / 5 + 32).toFixed(2);
      valTxt = valFx +'&deg;C / '+dF+'&deg;F'
    }
    tableRow.innerHTML = '<th scope "row">'+attr+'</th><td>'+valTxt+' '+icon+'</td>'
    tableBody.append(tableRow);
  });
}

///Hide/show auxiliary data
function toggleLatest() {
  // console.log('toggle');
  $.each(staAbbr , function(s, sta) {
//    console.log(sta);
    $.each(attrsArr , function(a, attr) {
      if (flagsArr.indexOf(attr) == -1) {
        $('#latestSpan_'+sta+'_'+attr).toggle();
      }
    });
  });
//  $('#latestSpan_UCSD_aux1').toggle()
}

///apply station colors to the stations' points in the map
function getStationStyle(sta) {
  bColor = stationsMeta[sta]['border-color'];
  fColor = stationsMeta[sta]['fill-color'];
  moreBColor = 'linear-gradient(to bottom,'+bColor+' 60%,'+fColor+' 100%)';
  moreFColor = 'linear-gradient(to bottom,'+fColor+' 80%,'+bColor+' 130%)';
  var staStyle = new ol.style.Style({
    image: new ol.style.Circle({
      radius: 5,
      fill: new ol.style.Fill({color: fColor }),
      stroke: new ol.style.Stroke({color: bColor, width: 2})
    })
  });

  $('#'+sta+'_well').css('border-color', bColor);
//  $('#'+sta+'_well').css('background-color', fColor);
  $('#'+sta+'_well').css('background-image', 'linear-gradient(to bottom,'+fColor+' 70%,'+bColor+' 190%)');

  timelineId = '#timeline_'+sta;
  $(timelineId).css('border-color', bColor);
//  $('#timeline_'+sta).css('background-color', bColor);
//  $('#timeline_'+sta).css('background-image', 'linear-gradient(to bottom,'+fColor+' 30%,'+bColor+' 150%)');
  $(timelineId).css('background', moreBColor);
  $(timelineId).css('color', 'white');


//  $(timelineId+':hover'+', '+timelineId+':focus').css('background', 'red');

  var staHover = document.createElement('style');
  staHover.type = 'text/css';
  staHover.innerHTML = '.'+'timeline_'+sta+'_hover { color: gray !important; background: '+moreFColor+' !important; }';
  document.head.appendChild(staHover);

//!!!.css() can't incorporate !important/order
//  $(timelineId+'.active').css('color', 'black');
//  $(timelineId+'.active'+', '+timelineId+':active').css('background', moreFColor);
  var staActive = document.createElement('style');
  staActive.type = 'text/css';
  staActive.innerHTML = '#'+'timeline_'+sta+'.active { color: black !important; background: '+moreFColor+' !important; }';
  document.head.appendChild(staActive);

  $(timelineId).hover(function () {
    //console.log('entering', $(this).attr('id'));
    $(this).addClass($(this).attr('id')+'_hover');
  }, function() {
      //console.log('leaving', $(this).attr('id'));
      $(this).removeClass($(this).attr('id')+'_hover');
  });

  return staStyle;
}

///returns time string of particular formats
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

//~~~~~~~~~~~~~~~~~~~~ Onload ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
$(function () {
  createLatestWells();
  $(document).on('change', 'input:radio[id^="station_"]', function (event) {
     // console.log("onchange: ", this.value);
     sensor = this.value;
     // getData();
     setStation();
  });
  //'.table > tbody > tr'
  //'.table.table-sm.table-hover'
  $(document).on('click', ".table.table-hover > tbody > tr", function() {
//    console.log('doc click row: ', $(this).attr('id'));
    selBtnId = $(this).attr('id');
    selBtnIdArr = selBtnId.split('_');
    selBtnSta = selBtnIdArr.slice(1, selBtnIdArr.length-1).join('_');
    selBtnAttr = selBtnIdArr[selBtnIdArr.length-1];
//console.log(selBtnSta, selBtnAttr);
    if (selBtnAttr != $('#attr').val()) $('#attr').val(selBtnAttr);
    if (selBtnSta != sensor) {
      $("#timeline_"+sensor).removeClass("active");
      sensor = selBtnSta;
      $("#timeline_"+sensor).addClass("active");
      setStation();
    } else {
      getData();
    }

  });

  sensor = $('.btn-group > .btn.active > input').val();
  // console.log($('.btn-group > .btn.active > input').val());
  // getData();
  setStation();

  $('#toggleFlag').click(function(){
    $('#collapseFlag').toggle();
    return false;
  });

  //~~~~~~~~~~~~~~~~~~~~Map ~~~~~~~~~~~~~~~~~~~~
  var testStyle = new ol.style.Style({
    image: new ol.style.Circle({
      radius: 5,
      fill: new ol.style.Fill({color: 'rgba(0, 0, 0, 0.7)' }),
      stroke: new ol.style.Stroke({color: '#FF0000', width: 2})

    })
  });

  ///map base layer
  var mapLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: 'http://server.arcgisonline.com/ArcGIS/rest/services/' +
        'Ocean_Basemap/MapServer/tile/{z}/{y}/{x}'
    })
//  source: new ol.source.MapQuest({layer: 'sat'})
  });

  ///stations layer
  var sassJson = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: '../../../static/projects/sass/autoshorestations.json',
      format: new ol.format.GeoJSON()
    }),
    //, style: styleFunction

/*
    style: new ol.style.Style({
      fill: new ol.style.Fill({color: 'rgba(240, 240, 240, 0.6)' }),
      stroke: new ol.style.Stroke({ color: '#CC33FF', width: 2 })
    })
*/

    style: function(feature, resolution) {
      staId = feature.getId()
      //return [testStyle];
      return [getStationStyle(staId)];
    }
/*
    style: new ol.style.Style({
      image: new ol.style.Circle({
        radius: 5,
        fill: new ol.style.Fill({color: 'rgba(40, 40, 40, 0.3)' }),
        stroke: new ol.style.Stroke({color: '#CC33FF', width: 2})
      })
    })
*/
  });

  ///Create map
  var map = new ol.Map({
    target: 'map',
    layers: [ mapLayer, sassJson ],
    view: new ol.View({
      center: ol.proj.transform([-118.5, 33.7], 'EPSG:4326', 'EPSG:3857'),
      zoom: 8
    })
  });

  var element = document.getElementById('popup');

  var popup = new ol.Overlay({
    element: element,
    positioning: 'bottom-center',
    stopEvent: false
  });
  map.addOverlay(popup);

  // display popup on click
  map.on('click', function(evt) {
    var feature = map.forEachFeatureAtPixel(evt.pixel,
        function(feature, layer) {
          return feature;
        });
    $(element).popover('destroy');
    if (feature) {
      var geometry = feature.getGeometry();
      var coord = geometry.getCoordinates();
      var hdms = ol.coordinate.toStringHDMS(ol.proj.transform(coord, 'EPSG:3857', 'EPSG:4326'));
      popup.setPosition(coord);
      $(element).popover({
        'placement': 'top',
        'html': true,
        //'content': feature.get('name')
        'content': feature.get('description')+'<br>'+hdms
      });
      $(element).popover('show');
    }
  });
});
