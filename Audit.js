/*
   SCRIPT FOR REPORTING PERFOMANCE 
   EPA DIGITAL
   @v1.0.0
   @change logs:
    -
   
*/

//VARIABLES FOR KEYWORDS COMPUTE DATA
var period = "LAST_7_DAYS";
var monthPeriod = "LAST_MONTH";
var almostImpressions = 25;
var activeCampaigns = [];
var brandCampaigns = [];
var averageQS;
var lowestQS = 9;
var qsStatus = []; //when kwQStatus is called, this array will have elements
var kwRelevance = []; //when kwQStatus is called, this array will have elements
var kwLandingRelevance = []; //when kwQStatus is called, this array will have elements
var negativesKw = []; //negatives function fills this array
var exactKws = [];


//VARIABLES FOR ADS COMPUTE DATA
var since_days = 200;
var to_days =  199;
var bad_code = 400;

//VARIABLES FOR BIDS
var targetCPA = 1000; //depending account update this variable
var days_for_cost = 60;
var costxconv_large = "LAST_MONTH"; //dateRange for cost per conversion query
var costxconv_short = "LAST_7_DAYS"; //dateRange for cost per conversion query during last seven days

//VARIABLES FOR GOOGLE SHEET
var CONFIG = {
  SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1Y0HVdUDtlFe9bDHkn3gDIsejqkQ5Ilg0ORzEqXZcUrs/edit#gid=0',
  COPY_SPREADSHEET: false,
  RECIPIENT_EMAILS: [
    'epa.soriana@gmail.com'
  ]  
};

var allData = {};

///////////////////////////////////////////////////////////////////////////////////// END OF VARIBLES ////////////////////////////////////////////////////////////////
 
//Just for know wich campaigns are enable and then work with them.
function fillActiveCampaigns(){
  var campaigns = AdWordsApp.campaigns()
  .withCondition("Status = ENABLED")
  .get();
  while(campaigns.hasNext()){
    var campaign = campaigns.next()
    activeCampaigns.push(campaign);
    //here if the name of the campaign match in any part with "Brand" string , I assume that it's a brand campaign
    if((campaign.getName().indexOf("Brand") != -1) || (campaign.getName().indexOf("BRAND") != -1))
      brandCampaigns.push(campaign);
    allData[campaign.getName()] = {};
  }
}

////////////////////////////////////////////////////////////////////////////// COMPUTE PERFORMANCE SETTINGS ///////////////////////////////////////////////////////
function targetLocation(Campaign){
  var type = [];

    var campaign = Campaign.getName();
    var locations = AdWordsApp.targeting().targetedLocations().withCondition('CampaignName = "'+campaign+'"').get();
    if(locations.hasNext()){
      var location = locations.next();
      var entity = location.getEntityType();
      var obj = {
        campaign : campaign,
        entity : entity,
      };
      type.push(obj);
      entity == "TargetedLocation" ? allData[campaign]["targetLocation"] = "OK" :  allData[campaign]["targetLocation"] = "X";
    }
  
  return type;
}

function rotation(campaign) {
 
  var rotation = campaign.getAdRotationType();
  rotation == "CONVERSION_OPTIMIZE" ? allData[campaign.getName()]["rotation"] = "OK" :allData[campaign.getName()]["rotation"] = "X";

}

function deliveryMode(campaign) {
  var deliveries = [];
  
  var budget = campaign.getBudget();
  var delivery = budget.getDeliveryMethod();
  
  delivery == "Accelerated" ? allData[campaign.getName()]["delivery"] = "OK" :allData[campaign.getName()]["delivery"] = "X";
  deliveries.push(delivery);
  
  return deliveries;
}

function languages(campaign) {
  allData[campaign.getName()]["languages"] = "-";
}

function Settings() { 
  for(i in activeCampaigns){
     var current = activeCampaigns[i] ;
     var types = targetLocation(current); 
     rotation(current);
     var deliveries = deliveryMode(current);
     languages(current);
  }

}

function genericCampaign(name) {
  if(name.indexOf("SEM") != -1 || name.indexOf("No Brand") != -1 || name.indexOf("Sem") != -1 || name.indexOf("NO BRAND") != -1 || name.indexOf("No BRAND") != -1)
    return true;
  else 
    return false;
}
////////////////////////////////////////////////////////////////////////// HERE START KEYWORDS DATA ////////////////////////////////////////////////////////////////////

//Verify if the number of '+' is equal to number of spaces plus one, because the broad structure is: +word1 +word2 +word3 and so on 
function checkPlus(cad) {
  var lower = cad.toLowerCase();
  var spaces = lower.split(' ').length-1;
  var plus = lower.split('+').length-1;
  
  if (spaces+1 == plus)
    return false 
  else
    return true;
}


function cleanKw(kw) {
  kw = kw.replace(/\]/g, '');
  kw = kw.replace(/\[/g, '');
  return kw;
}

//Inspect if the keyword has the correct structure for broad concordance
function noPlusKw(campaign){
  var wrongKW = [];
    var keywords = campaign.keywords()
    .withCondition("Status = ENABLED")
    .withCondition("KeywordMatchType = BROAD")
    .get();
    
    while(keywords.hasNext()){
      var kw = keywords.next();
      if( checkPlus(kw.getText()) ){
        var wg = {
          campaign : activeCampaigns[i].getName(),
          adGroup :  kw.getAdGroup(),
          text : kw.getText(),
        };
        allData[campaign.getName()]["badConcordance"] = "X";
        wrongKW.push(wg);
      }
    }
  
    if(allData[campaign.getName()]["brandQS"] != "X")
       allData[campaign.getName()]["brandQS"] = "OK";

  return wrongKW;
}

function kwQStatus(campaign){
  var report = AdWordsApp.report(
    'SELECT Criteria, CampaignName, AdGroupName, QualityScore, SearchPredictedCtr, CreativeQualityScore, PostClickQualityScore ' +
    'FROM   KEYWORDS_PERFORMANCE_REPORT ' +
    'WHERE  Impressions > 25 ' +
    'AND CampaignName = ' + campaign.getName() +
    ' DURING '+period,{apiVersion: 'v201605'});

  var rows = report.rows();
  while(rows.hasNext()) {
    var row = rows.next();
    var QS = row['QualityScore'];
    var expCTR = row['SearchPredictedCtr'];
    var adRelevance = row['CreativeQualityScore'];
    var landingRelevance = row['PostClickQualityScore'];
    var isGeneric =  genericCampaign(row['CampaignName']);
    
    if(parseFloat(QS) > 1.0)
      Logger.log(QS);
    
    if((expCTR == "Below average" || expCTR == "Average") && isGeneric){
      var kw = {
        campaign : row['CampaignName'],
        adGroup : row['AdGroupName'],
        text : row['Criteria'],
        status : expCTR,
      }; 
      qsStatus.push(kw);
    }
    if((adRelevance == "Below average" || adRelevance == "Average") && isGeneric){
      var kw = {
        campaign : row['CampaignName'],
        adGroup : row['AdGroupName'],
        text : row['Criteria'],
        relevance : adRelevance,
      };
      kwRelevance.push(kw);
    }
    if(landingRelevance == "Below average" && isGeneric){
      var kw = {
        campaign : row['CampaignName'],
        adGroup : row['AdGroupName'],
        text : row['Criteria'],
        landingRelevance : landingRelevance,
      };
      kwLandingRelevance.push(kw);
    }
  }
}

//keywords of brand campaigns with QS < 9
function brandKWQS(campaign){
  var qslessnine = [];

   var kws = campaign.keywords().get(); 
    while(kws.hasNext()){
      var kw = kws.next();
      var qs = kw.getQualityScore();
      if(qs < lowestQS){
        var kwless = {
          campaign : campaign.getName(),
          adGroup : kw.getAdGroup(),
          text : kw.getText(),
          QS: qs,
        };
        allData[campaign.getName()]["brandQS"] = "X";
        qslessnine.push(kwless);
      }
    }
    if(allData[campaign.getName()]["brandQS"] != "X")
      allData[campaign.getName()]["brandQS"] = "OK";

  return qslessnine;
}

function withOutNegatives() {
  var campsWONeg = [];
  for(var i = 0; i < activeCampaigns.length; i++){
    var totalKws = activeCampaigns[i].negativeKeywords().get().totalNumEntities();
    if(totalKws == 0)
      campsWONeg.push(activeCampaigns[i].getName());
  }
  return campsWONeg;
}

function negatives() {
  for(var i = 0; i < activeCampaigns.length; i++) {
    var negatives = activeCampaigns[i].negativeKeywords()
    .withCondition("KeywordMatchType = EXACT")
    .get();
    
    while(negatives.hasNext()){
      var negative = negatives.next();
      var kw = cleanKw(negative.getText());
      negativesKw.push(kw);
    }
  }
}


function ExactKws() {
  for(i in activeCampaigns){
    var campaign = activeCampaigns[i];
    var kws = campaign.keywords()
    .withCondition("KeywordMatchType = EXACT")
    .withCondition("Status = ENABLED")
    .get();
    
    while(kws.hasNext()) {
      var kw = kws.next();
      var kwText = cleanKw(kw.getText());
      exactKws.push(kwText);
    }
  }
}

function searchTerms() {
   var shouldBe = [];
   ExactKws();
  
   var report = AdWordsApp.report(
      'SELECT Query, Clicks, Cost, Ctr, ConversionRate,' +
      ' CostPerConversion, Conversions, CampaignId, AdGroupId' +
      ' FROM SEARCH_QUERY_PERFORMANCE_REPORT' +
      ' WHERE ' +' Conversions > 0' +
      ' AND Impressions > ' + almostImpressions +'');
  
  var rows = report.rows();
  while(rows.hasNext()) {
    var row = rows.next();
    var query = row['Query'];
    if(exactKws.indexOf(query) == -1 && shouldBe.indexOf(query) == -1)
      shouldBe.push(query);
  }
  return shouldBe;
}

function searchTermsClicks() {
  var noExactKws = [];
      
  var report = AdWordsApp.report(
      'SELECT Query, Clicks, Cost, Ctr, ConversionRate,' +
      ' CostPerConversion, Conversions, CampaignId, AdGroupId' +
      ' FROM SEARCH_QUERY_PERFORMANCE_REPORT' +
      ' WHERE Clicks > 10' +
      ' AND Impressions > ' + almostImpressions +
      ' DURING '+monthPeriod,{apiVersion: 'v201605'});
  
  var rows = report.rows();
  while(rows.hasNext()) {
    var row = rows.next();
    var query = row['Query'];
    if(parseFloat(row['Ctr']) > 10 && exactKws.indexOf(query) == -1 && noExactKws.indexOf(query) == -1)
      noExactKws.push(query);
  }
  return noExactKws;
}


function searchTermsNegatives() {
  var shouldBeNegatives = [];
  negatives();
  
   var report = AdWordsApp.report(
      'SELECT Query, Clicks, Cost, Ctr, ConversionRate, Impressions,' +
      ' CostPerConversion, Conversions, CampaignId, AdGroupId' +
      ' FROM SEARCH_QUERY_PERFORMANCE_REPORT' +
      ' WHERE Impressions > 200' +
      ' DURING '+monthPeriod,{apiVersion: 'v201605'});
  
  var rows = report.rows();
  while(rows.hasNext()) {
    var row = rows.next();
    var query = row['Query'];
    if(negativesKw.indexOf(query) == -1 && shouldBeNegatives.indexOf(query) == -1 && parseFloat(row['Ctr']) < 1)
      shouldBeNegatives.push(query);
  }
  return shouldBeNegatives;
}

//when answer the question run this function
function repeatedKeywords() {
  var allKeywords = [];
  var repeatedKws = []; 
  
  for(i in activeCampaigns) {
    var kws = activeCampaigns[i].keywords().get();
    while(kws.hasNext()) {
      var it =  kws.next();
      var kw = it.getText();
      if(allKeywords.indexOf(kw) != -1 )
        repeatedKws.push(kw);
      else
        allKeywords.push(kw);
    }
  }
  return repeatedKws;
}

//Function that reports keywords and QS perfomance, and handler for all keywords data
function KeyWords() {
  for(i in activeCampaigns){
    var campaign = activeCampaigns[i];
    var a = noPlusKw(campaign)
    if(isBrand(campaign.getName()))
     var b = brandKWQS(campaign); 
    else
      allData[campaign.getName()]["brandQS"] = "N/A";
  }
  //var kwlessQS = brandKWQS();
  //kwQStatus(); //fills qsStatus array
  //var woNegatives = withOutNegatives();
  //var shouldBeInExact = searchTerms();    
  //var noExactKws = searchTermsClicks();
  //var shouldbeNegatives = searchTermsNegatives();
  //var repeated = repeatedKeywords();
}

////////////////////////////////////////////////////////////////////////// HERE FINISH KEYWORDS DATA AND START ADS DATA ////////////////////////////////////////////////////////////////////

function lessTwo() {
   var adGroups = [];
 
  for(i in activeCampaigns) {
    if(activeCampaigns[i].getName() == "AW_DO_SEM_MPNs")
      continue;
    var adgroups = activeCampaigns[i].adGroups().get();
    while(adgroups.hasNext()) {
      var adg = adgroups.next();
      var ads = adg.ads()
        .withCondition("Status = ENABLED")
        .get()
      if(ads.totalNumEntities() < 2) {
        var adgroup = {
          campaign : activeCampaigns[i].getName(),
          adGroup : adg.getName(),
          ads : ads.totalNumEntities(),
        };
        adGroups.push(adgroup)
      }
    }
  }
  return adGroups;  
}

function oldETAAds() {
  var oldAds = [];
  var startDate = new Date();
  startDate.setDate(startDate.getDate() - since_days);
  startDate = Utilities.formatDate(startDate, AdWordsApp.currentAccount().getTimeZone(),"yyyyMMdd");
  
  var endDate = new Date();
  endDate.setDate(endDate.getDate() - to_days);
  endDate = Utilities.formatDate(endDate, AdWordsApp.currentAccount().getTimeZone(),"yyyyMMdd");
    
  var dateRange = startDate+','+endDate;
  
  var report = AdWordsApp.report(
      'SELECT Date,Id,AdGroupId,CampaignId,Conversions' +
      ' FROM AD_PERFORMANCE_REPORT' +
      ' WHERE Impressions > 20' +
      ' DURING '+dateRange,{apiVersion: 'v201605'});
  
  var rows = report.rows();
  while(rows.hasNext()){
    var row = rows.next();
    
    var campaign = AdWordsApp.campaigns()
      .withIds([row['CampaignId']])
      .withCondition('Status = ENABLED')
      .get();
    
    if(campaign.totalNumEntities() > 0){
      var camp = campaign.next();
      var ids = [[row['AdGroupId'],row['Id']]];
      var ads = camp.ads().withIds(ids).get().next();
      var  ad = {
        title : ads.getHeadline(),
        adGroup : ads.getAdGroup(),
        campaign : camp.getName(),
      };
      oldAds.push(ad);
    }
  }
  return oldAds;
}

function url404() {
  var badUrls  = [];
  var checked  = [];
  var badCodes = [];
  
  var iters = [
    AdWordsApp.ads()
      .withCondition("Status = 'ENABLED'")
      .withCondition("AdGroupStatus = 'ENABLED'")
      .withCondition("CampaignStatus = 'ENABLED'")
      .withCondition("Type = 'TEXT_AD'")
      .get()
  ];
  for(i in iters){
    var iter = iters[i];
    while(iter.hasNext()){
      var entity = iter.next();
      var url = entity.urls().getFinalUrl();

      if(url == null) 
        continue;
      if(url.indexOf('{') >= 0) {
        url = url.replace(/\{[0-9a-zA-Z]+\n}/g,'');
      }
      if(checked[url])
        continue;
      var response_code;
      try{
        response_code = UrlFetchApp.fetch(url).getResponseCode();
        Logger.log(response_code);
      }catch(e){
        
        badUrls.push({e:entity,code: response_code});
        Logger.log("something wrong");
      }
      if(response_code == bad_code)
        badCodes.push({entity: entity,response: response_code});
      checked[url] = true;
    }
  }
  var res = {
    badUrls : badUrls,
    badCodes: badCodes,
  };
  return res;
}

function Ads() {
  //var lessTwoAds = lessTwo();
  //var oldAds = oldETAAds();
  //var invalidUrls = url404();
}

//////////////////////////////////////////////////////////////////////////////////////////////  HERE FINISH ADS AND START EXTENSIONS PERFORMANCE REPORT   ///////////////////////////////

function activeSiteLinks() {
  var less4sitelinks = [];
  var temp = [];
  
  for(i in activeCampaigns){
    var curr_camp = activeCampaigns[i];
    var sitelinks = curr_camp.extensions().sitelinks().get();
    var count = 0;
    if(sitelinks.totalNumEntities() == 0){
      if(less4sitelinks.indexOf(curr_camp) == -1)
        less4sitelinks.push(curr_camp);
      continue;
    }
    while(sitelinks.hasNext()){
      var sitelink = sitelinks.next();
      var impressions_yes = sitelink.getStatsFor("YESTERDAY").getImpressions();
      var impressions_tod = sitelink.getStatsFor("TODAY").getImpressions();
      if(impressions_yes > 0 && impressions_tod > 0)
        count++;
    }
    if(count < 4 )
      if(less4sitelinks.indexOf(curr_camp) == -1)
        less4sitelinks.push(curr_camp);
  }
  return less4sitelinks;
}


function activeCallouts() {
  var inactive = [];
  
  for(i in activeCampaigns){  
    var curr_camp = activeCampaigns[i];
    var callouts = curr_camp.extensions().callouts().get();
    var count = 0;
    if(callouts.totalNumEntities() == 0){
      if(inactive.indexOf(curr_camp) == -1)
        inactive.push(curr_camp);
      continue;
    }
    while(callouts.hasNext()){
      var callout = callouts.next();
      var impressions_yes = callout.getStatsFor("YESTERDAY");
      var impressions_tod = callout.getStatsFor("TODAY");
      if(impressions_yes > 0 && impressions_tod > 0)
        count++;
    }
    if(count < 2)
      inactive.push(curr_camp);
  }
  return inactive;
}

function siteLinksWODesc(){
  var withoutDesc = [];
  
  for(i in activeCampaigns){
    var curr_campaign = activeCampaigns[i];
    var sitelinks = curr_campaign.extensions().sitelinks().get();
    while(sitelinks.hasNext()){
      var sitelink = sitelinks.next();
      var description1 = sitelink.getDescription1();
      var description2 = sitelink.getDescription2();
      Logger.log(description1+"  "+description2);
      if(description1 == null || description2 == null){
        var stL = {
          id : sitelink.getId(),
          campaign : activeCampaigns[i].getName(),
          description1: description1,
          description2 : description2,
        };
        withoutDesc.push(stL);
      }
    }
  }
  return withoutDesc;
}

function Extensions() {
 //var withoutDescription = siteLinksWODesc();
 //var active = activeSiteLinks();
  var activeCall = activeCallouts();
}

////////////////////////////////////////////////////////////////////////////// HERE FINISH EXTENSIONS FUNCTIONS AND START BID FUNCTIONS //////////////////////////////////////////////////

function isBrand(name) {
  if(name.indexOf("Brand") != -1 || name.indexOf("BRAND") != -1 || name.indexOf("brand") != -1 || name.indexOf("Brn")!=-1 || name.indexOf("BRN")!=-1)
    return true;
  return false;
}

function cleanCost(cost) {
  return cost.replace(/\,/g,'');
}

function daysAgo() {
  var startDate = new Date();
  startDate.setDate(startDate.getDate() - days_for_cost);
  startDate = Utilities.formatDate(startDate, AdWordsApp.currentAccount().getTimeZone(),"yyyyMMdd");
  
  var endDate = new Date();
  var dateRange = startDate+','+endDate;
  return dateRange;
}

function manualCPC() {
  var campaignsManualCPC = [];
    
  for(i in activeCampaigns){
    if(isBrand(activeCampaigns[i].getName()))
      continue;
    
    var type = activeCampaigns[i].bidding().getStrategyType();
    if(type == "MANUAL_CPC")
      campaignsManualCPC.push(activeCampaigns[i].getName());
  }
  return campaignsManualCPC;
}

function adGroupsOverCPA() {
  var over = [];
  
  for(i in activeCampaigns) {
    if(isBrand(activeCampaigns[i].getName()))
      continue;

    var adGroups = activeCampaigns[i].adGroups()
      .withCondition("Status = ENABLED")
      .withCondition("Cost > "+3*targetCPA+'')
      .withCondition("Impressions = 0")
      .forDateRange("LAST_MONTH")
      .get();
    while(adGroups.hasNext()){
      var adGroup = adGroups.next();
      over.push(adGroup);    
    }
  }
  return over;
}

function costPerConversion() {
  var adgroupsOver = [];
  
  var report = AdWordsApp.report(
      'SELECT CostPerConversion, AdGroupName, AdGroupStatus, AdGroupId' +
      ' FROM ADGROUP_PERFORMANCE_REPORT'+
      ' WHERE CostPerConversion > ' + 3*targetCPA +
      ' DURING '+costxconv_large);
  
  var rows = report.rows();
  while(rows.hasNext()) {
    var row     = rows.next();
    var cost    = row['CostPerConversion'];
    var adgroup = row['AdGroupName'];
    cost = cleanCost(cost);
    
    if(parseFloat(cost) > 3*targetCPA )
      adgroupsOver.push(adgroup);
  }
  return adgroupsOver;
}

function costPerConversion7days() {
  var overDuring7days = [];
  var adGroupsIds = [];
  
   var report = AdWordsApp.report(
      'SELECT CostPerConversion, AdGroupName, AdGroupStatus, AdGroupId' +
      ' FROM ADGROUP_PERFORMANCE_REPORT'+
      ' WHERE CostPerConversion > ' + 3*targetCPA +
      ' DURING '+costxconv_short);
  
  var rows = report.rows();
  while(rows.hasNext()){
    
    var row     = rows.next();
    var cost    = row['CostPerConversion'];
    var adgroup = row['AdGroupName'];
    cost  = cleanCost(cost);
  
    if(parseFloat(cost) > 3*targetCPA){
      overDuring7days.push(adgroup);
      adGroupsIds.push(row['AdGroupId']);
    }
  }
  var obj = {
    adGroupNames : overDuring7days,
    adGroupIds   : adGroupsIds,
  }
  return obj;
}

function devicesPerAdgroup() {
  var adgroups = costPerConversion7days();
  var data = {};
  var adGroups = {};
  for(i in adgroups.adGroupIds){
    var id = adgroups.adGroupIds[i];
    adGroups[id] = {}
    
    var report = AdWordsApp.report(
      'SELECT CostPerConversion, AdGroupName, AdGroupId, Device' +
      ' FROM AUDIENCE_PERFORMANCE_REPORT'+
      ' WHERE AdGroupId = ' + adgroups.adGroupIds[i] +
      ' DURING '+costxconv_short);  
    
    var rows = report.rows();
    var ar = {};
  
    while(rows.hasNext()){
      var row = rows.next();
      var deviceCount = adGroups[id][row['Device']]
      deviceCount ? deviceCount++ : deviceCount = 1;
      adGroups[id][row['Device']] = deviceCount;
    }
  }
  return adGroups;
}

function geoCampaign() {
  var countries = [];
  
  for(i in activeCampaigns){
    var campaign = activeCampaigns[i];
    var id = campaign.getId();
    
    if(isBrand(campaign.getName()))
      continue;
    
    var report = AdWordsApp.report(
      'SELECT CostPerConversion, CampaignId, CityCriteriaId, CountryCriteriaId' +
      ' FROM GEO_PERFORMANCE_REPORT'+
      ' WHERE CampaignId = ' + id +
      ' DURING '+costxconv_short);  
    
    var rows = report.rows();
    while(rows.hasNext()){
      var row = rows.next();
      var cost = row['CostPerConversion'];
      cost = cleanCost(cost);
      if(parseFloat(cost) > 3*targetCPA){
        countries.push(row['CityCriteriaId']);
      }
    }
  }
  return countries;
}

function genreCampaign() {
  var obj = {};
  
  for(i in activeCampaigns){
    var campaign = activeCampaigns[i];
    var id  = campaign.getId();
    
    if(isBrand(campaign.getName()))
      continue;
    
    var report = AdWordsApp.report(
      'SELECT CostPerConversion, CampaignId, Criteria' +
      ' FROM GENDER_PERFORMANCE_REPORT'+
      ' WHERE CampaignId = ' + id +
      ' DURING '+costxconv_short);
    
    var rows = report.rows();
    while(rows.hasNext()){
      var row = rows.next();
      var cost = row['CostPerConversion'];
      cost = cleanCost(cost);
      if(parseFloat(cost) > 3*targetCPA)
        obj[row['Criteria']] ? obj[row['Criteria']]++ : obj[row['Criteria']] = 1;
    }
  }
  return obj;
}

function daysOfTheWeek() {
  var response = [];
  for(i in activeCampaigns){
    var campaign = activeCampaigns[i];
    var id = campaign.getId();
    
    if(isBrand(campaign.getName()))
      continue;
    
     var report = AdWordsApp.report(
      'SELECT CostPerConversion, CampaignId, DayOfWeek' +
      ' FROM CAMPAIGN_PERFORMANCE_REPORT'+
      ' WHERE CampaignId = ' + id +
      ' DURING '+costxconv_short);
    
    var rows = report.rows();
    var daysof = [];
    while(rows.hasNext()){
      var row = rows.next();
      var cost = row['CostPerConversion'];
      cost = cleanCost(cost);
      if(parseFloat(cost) > 3*targetCPA)
        daysof.push(row['DayOfWeek']);
    }
    Logger.log(daysof)
    var obj = {
      campaign : campaign.getName(),
      days : daysof,
    };
    response.push(obj);
  }
  return response;
}


function hoursOfDay() {
  var response = [];
  
  for(i in activeCampaigns){
    var campaign = activeCampaigns[i];
    var id = campaign.getId();
    
    if(isBrand(campaign.getName()))
      continue;
    
    var report = AdWordsApp.report(
     'SELECT CostPerConversion, CampaignId, HourOfDay' +
     ' FROM CAMPAIGN_PERFORMANCE_REPORT'+
     ' WHERE CampaignId = ' + id +
     ' DURING '+costxconv_short);
    
    var rows = report.rows();
    var hours = [];
    while(rows.hasNext()){
      var row = rows.next();
      var cost = row['CostPerConversion'];
      cost = cleanCost(cost);
      if(parseFloat(cost) > 3*targetCPA)
        hours.push(row['HourOfDay']);
    }
    var obj = {
      campaign : campaign.getName(),
      hours : hours,
    };
    response.push(obj);
  }
  return response;
}


function Bids() {
  //var camps = manualCPC();
  //adGroupsOverCPA();
  //var adGroups = costPerConversion();
  //var over7days = costPerConversion7days();
  //var d = devicesPerAdgroup(); returns an object be careful manipulating it
  //var countries = geoCampaign();
  //var gender = genreCampaign();
  //var a = daysOfTheWeek();
  //var d = hoursOfDay();
}

//////////////////////////////////////////////////////////////////////////////////////     HERE FINISH BIDS FUNCTIONS ////////////////////////////////////////////////


function writeHeaders(s) {
  var headers = ['','SETTINGS','KEYWORDS & QS','ADS','EXTENSIONS','BIDS'];
  var columns = [3,4,10,2,4,9];
 
  var last = 1;
  var sheet = s.getSheetByName("general");
  for(var i = 0; i < headers.length ; i++){
     var range = sheet.getRange(1,last,1,parseInt(columns[i]));
     last += columns[i];
     range.setValue(headers[i]).mergeAcross().setHorizontalAlignment("center").setFontSize(14);
  }
  var r = sheet.getRange(2,1,1,3);
  r.setValue("CAMPAIGN NAME").mergeAcross().setHorizontalAlignment("center").setFontSize(14);
}

function writeSecondHeaders(s) {
  var headers = {
    settings : ['Target Location','Rotation','Delivery(acelerated)','languages'],
    keywords : ['concod.(+)','QS<9','QS below avg','QS avg','adRelevance below avg',
               'adRelevance avg','quality landing below avg','adgroups sin neg','serch terms and no exact'],
    ads : ['AG less 2 adds active','old ads','ads 404'],
    extensions : ['less 4 sitelinks active','brand less 4 SL active','less 2 callouts active','SL sin descrp.'],
    bids : ['cpc manual','AG costo > 3xCPAobj sin conv','AG cost/conv > 3xCPAobj','device per AG cost/conv > 3XCPA',
           'ubicaciones per camp cost/conv > 3xCPAobj','generos per camp cost/conv > 3xCPAobj',
            'days per camp cost/conv > 3xCPAobj','hours per camp cost/conv > 3xCPA'],
  };
  var col = 4;
  var sheet = s.getSheetByName("general");
  for(k in headers){
    for(var i = 0; i < headers[k].length; i++){
      var range = sheet.getRange(2,col);
      var value = headers[k][i];
      range.setValue(value).setHorizontalAlignment('center');
      col++;
    }
  }
}

function clearContent(s) {
  var sheets = s.getSheets();
  for(i in sheets){
    var sheet = sheets[i];
    sheet.clear();
  }
}

function fillObj(obj,fields) {
  
}

function formatData(s) {
  var sheet =  s.getSheetByName("general");
  var fields = sheet.getRange(2,4,1,30).getValues();
  
  for(i in activeCampaigns){
    allData[activeCampaigns[i]] = {};
    fillObj(allData[activeCampaigns[i]], fields);
  }
}


function initSpreadsheet() {
  var spreadsheet = SpreadsheetApp.openByUrl(CONFIG.SPREADSHEET_URL);
  
  if (CONFIG.COPY_SPREADSHEET) 
    spreadsheet = spreadsheet.copy('Audit Script');
  
  clearContent(spreadsheet);
  
  writeHeaders(spreadsheet);
  
  writeSecondHeaders(spreadsheet);
  formatData(spreadsheet);
  return spreadsheet;
}

function writeDataGeneral(s) {
  var sheet = s.getSheetByName("general");
  var row = 3;
 
  for(k in allData){
    var range = sheet.getRange(row,1,1,3);
    var column = 4;
    range.setValue(k).mergeAcross().setHorizontalAlignment('center');
    Logger.log(k)
    for(kk in allData[k]){
        Logger.log(kk+" : "+allData[k][kk])
        var r = sheet.getRange(row,column);
        r.setValue(allData[k][kk]).setHorizontalAlignment('center');
        column++;
    }
    row++;
  }
  
}
  
function main() {  
   fillActiveCampaigns();
   var settingsData = Settings();  
   KeyWords();
   /*Ads();
   Extensions();
   Bids();**/
   var spreadsheet = initSpreadsheet();
   writeDataGeneral(spreadsheet);
  
}
