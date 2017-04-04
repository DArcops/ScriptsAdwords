/*
   SCRIPT FOR REPORTING PERFOMANCE 
   EPA DIGITAL
   @v1.0.0
   @change logs:
    -
   
*/

//QUALITY SCORE FACTOR VARIBALE
var QSFactor = 3;

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
  var data = [];
  
  var campaign = Campaign.getName();
  var locations = AdWordsApp.targeting().targetedLocations().withCondition('CampaignName = "'+campaign+'"').get();
  if(locations.hasNext()){
    var location = locations.next();
    var entity = location.getEntityType();
    data.push(entity);
    entity == "TargetedLocation" ? allData[campaign]["targetLocation"] = "OK" :  allData[campaign]["targetLocation"] = "X";
  }
  var response = {
    data : data,
    adgroups : [],
  };
  
  return response;
}

function rotation(campaign) {
  
  var rotation = campaign.getAdRotationType();
  rotation == "CONVERSION_OPTIMIZE" ? allData[campaign.getName()]["rotation"] = "OK" :allData[campaign.getName()]["rotation"] = "X";
  var response = {
    data : [rotation],
    adgroups : [],
  };
  return response;
}

function deliveryMode(campaign) {
  
  var budget = campaign.getBudget();
  var delivery = budget.getDeliveryMethod();
  
  delivery == "Accelerated" ? allData[campaign.getName()]["delivery"] = "OK" :allData[campaign.getName()]["delivery"] = "X";
  
  var response = {
    data : [delivery],
    adgroups : [],
  };
  return response;
}

function languages(campaign) {
  allData[campaign.getName()]["languages"] = "-";
}

function Settings(s) { 
  
  var headers = ["Campaign","Geo","Rotation","Publish"];
  writeHds(s,headers);
  
  for(i in activeCampaigns){
    var obj = {};
  obj["data"] = [];
  obj["adgroups"] = [];
    
     var current = activeCampaigns[i] ;
     var loc = targetLocation(current);
     obj.data = obj.data.concat(loc.data);
     var rot = rotation(current);
     obj.data = obj.data.concat(rot.data);
     var deliveries = deliveryMode(current);
     obj.data = obj.data.concat(deliveries.data);
     writeInSheet(s,current.getName(), obj)
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
  var adgroups = [];
  
    var keywords = campaign.keywords()
    .withCondition("Status = ENABLED")
    .withCondition("KeywordMatchType = BROAD")
    .get();
    AdWordsApp.keywords().get().next().getAdGroup().getName()
    if(keywords.totalNumEntities() == 0)
      allData[campaign.getName()]["badConcordance"] = "X";
      
    while(keywords.hasNext()){
      var kw = keywords.next();
      if( checkPlus(kw.getText()) ){
        adgroups.push(kw.getAdGroup().getName());
        wrongKW.push(kw.getText());
        allData[campaign.getName()]["badConcordance"] = "X";
        
      }
    }
   
    if(allData[campaign.getName()]["badConcordance"] != "X")
       allData[campaign.getName()]["badConcordance"] = "OK";
 
  var response = {
    data : wrongKW,
    adgroups : adgroups,
  };

  return response;
}

function kwQStatus(campaign){
  var adgroups = [];
  var data = [];
  var report = AdWordsApp.report(
    'SELECT Criteria, CampaignName, AdGroupName, QualityScore, SearchPredictedCtr, CreativeQualityScore, PostClickQualityScore ' +
    'FROM   KEYWORDS_PERFORMANCE_REPORT ' +
    'WHERE  Impressions > 25 ' +
    ' DURING '+period);

  var rows = report.rows();
  allData[campaign.getName()]["QSBelow"] = 0;
  allData[campaign.getName()]["QSAverage"] = 0;
  allData[campaign.getName()]["QSAdBelow"] = 0;
  allData[campaign.getName()]["QSAdAverage"] = 0;
  allData[campaign.getName()]["QSLandingBelow"] = 0;
  
  while(rows.hasNext()) {
    var row = rows.next();
    
    if(row['CampaignName'] != campaign.getName())
      continue;
    
    var QS = row['QualityScore'];
    var expCTR = row['SearchPredictedCtr'];
    var adRelevance = row['CreativeQualityScore'];
    var landingRelevance = row['PostClickQualityScore'];
    
    
    if(expCTR == "Below average"){ 
      allData[campaign.getName()]["QSBelow"] += 1;
      Logger.log( allData[campaign.getName()]["QSBelow"])
      data.push(row['Criteria']+" (Below Average expected CTR)");
      adgroups.push(row['AdGroupName']);
    }
    if(expCTR == "Average"){
      allData[campaign.getName()]["QSAverage"] += 1;
      data.push(row['Criteria']+" (Average expected CTR)");
      adgroups.push(row['AdGroupName']);
    }
    if(adRelevance == "Below average"){
      data.push(row['Criteria']+" (Below Average ad Relevance)");
      adgroups.push(row['AdGroupName']);
      allData[campaign.getName()]["QSAdBelow"] += 1;
    }
     if(adRelevance == "Average"){
      allData[campaign.getName()]["QSAdAverage"] += 1;
      data.push(row['Criteria']+" (Average expected CTR)");
      adgroups.push(row['AdGroupName']);
    }
    if(landingRelevance == "Below average"){
      allData[campaign.getName()]["QSLandingBelow"] += 1;
      data.push(row['Criteria']+" (Below Average Landing Relevance)");
      adgroups.push(row['AdGroupName']);
    }
  }
  var response = {
    data : data,
    adgroups: adgroups,
  };
  return response;
}

//keywords of brand campaigns with QS < 9
function brandKWQS(campaign){
  var qslessnine = [];
  var adgroups = [];
  
   var kws = campaign.keywords().get(); 
    while(kws.hasNext()){
      var kw = kws.next();
      var qs = kw.getQualityScore();
      if(qs < lowestQS && qs != null){
        allData[campaign.getName()]["brandQS"] = "X";
        qslessnine.push(kw.getText()+" (QS = "+qs+")");
        adgroups.push(kw.getAdGroup().getName());
      }
    }
    if(allData[campaign.getName()]["brandQS"] != "X")
      allData[campaign.getName()]["brandQS"] = "OK";
  
  var response = {
    data : qslessnine,
    adgroups : adgroups,
  };
  return response;
}

function withOutNegatives(campaign) {
  var campsWONeg = [];
    
    allData[campaign.getName()]["Cmpsineg"] = "OK";
    var totalKws = activeCampaigns[i].negativeKeywords().get().totalNumEntities();
  if(totalKws == 0){
      campsWONeg.push(activeCampaigns[i].getName());
    allData[campaign.getName()]["Cmpsineg"] = "X";
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

function searchTerms(campaign) {
   var shouldBe = [];
   var adgroups = [];
   ExactKws();
   
   allData[campaign.getName()]["SearchNoNoNegative"] = 0;
  
   var report = AdWordsApp.report(
      'SELECT Query, Conversions, CampaignId, AdGroupName' +
      ' FROM SEARCH_QUERY_PERFORMANCE_REPORT' +
      ' WHERE ' +' Conversions > 0' +
      ' AND CampaignId = '+campaign.getId()+
      ' AND Impressions > ' + almostImpressions +'');
  
  var rows = report.rows();

  while(rows.hasNext()) {
    var row = rows.next();
    var query = row['Query'];
    var adgroup = row['AdGroupName'];
    if(exactKws.indexOf(query) == -1 && shouldBe.indexOf(query) == -1){
      shouldBe.push(query);
      adgroups.push(adgroup);
      allData[campaign.getName()]["SearchNoNoNegative"] += 1;
    }
  }
  
  var response = {
    data : shouldBe,
    adgroups : adgroups,
  };
  
  return response;
}

function searchTermsClicks(campaign) {
  var noExactKws = [];
      
  var report = AdWordsApp.report(
      'SELECT Query, Clicks, CampaignId, Ctr' +
      ' FROM SEARCH_QUERY_PERFORMANCE_REPORT' +
      ' WHERE Clicks > 10' +
      ' AND CampaignId = '+campaign.getId()+
      ' AND Impressions > ' + almostImpressions +
      ' DURING '+monthPeriod);
  
  allData[campaign.getName()]["SearchTerms>10"] = 0;
  
  var rows = report.rows();
  while(rows.hasNext()) {
    var row = rows.next();
    var query = row['Query'];
    //Logger.log(campaign.getName()+" "+query+"   "+row['Clicks']+"   "+parseFloat(row['Ctr']))
    if(parseFloat(row['Ctr']) > 10 && exactKws.indexOf(query) == -1 && noExactKws.indexOf(query) == -1){
      noExactKws.push(query);
       allData[campaign.getName()]["SearchTerms>10"] += 1;
    }
  }
  return noExactKws;
}


function searchTermsNegatives(campaign) {
  var shouldBeNegatives = [];
  negatives();
  
   var report = AdWordsApp.report(
      'SELECT Query, Clicks, Cost, Ctr, ConversionRate, Impressions,' +
      ' CostPerConversion, Conversions, CampaignId, AdGroupId' +
      ' FROM SEARCH_QUERY_PERFORMANCE_REPORT' +
      ' WHERE Impressions > 200' +
      ' AND CampaignId = '+campaign.getId()+
      ' DURING '+monthPeriod);
  
  allData[campaign.getName()]["searchTerms<1"] = 0;
  
  var rows = report.rows();
  while(rows.hasNext()) {
    var row = rows.next();
    var query = row['Query'];
    if(negativesKw.indexOf(query) == -1 && shouldBeNegatives.indexOf(query) == -1 && parseFloat(row['Ctr']) < 1)
      shouldBeNegatives.push(query);
      allData[campaign.getName()]["searchTerms<1"] += 1;
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
function KeyWords(s) {
  
  
  for(i in activeCampaigns){
    var row = s.getLastRow()+1
    var obj = {};
    obj["data"] = [];
    obj["adgroups"] = [];
    
    var campaign = activeCampaigns[i];
    var headers = ["Campaign","AdGroup","keywords en amplia que no incluyen '+'"];
    writeHds(s, headers);
    var a = noPlusKw(campaign);
    writeColumn(s,campaign.getName(),3,a);
    
    if(isBrand(campaign.getName())){
      var headers = ["Campaign","AdGroup","keywords de las campañas “Brand” con QS<9"];
      writeHds(s, headers);
      var b = brandKWQS(campaign); 
      writeColumn(s,campaign.getName(),3,b);
    }
    else
      allData[campaign.getName()]["brandQS"] = "N/A";
    
    if(genericCampaign(campaign.getName())){
      var headers = ["Campaign","AdGroup","QS Status"];
      writeHds(s, headers);
      var c = kwQStatus(campaign);
      writeColumn(s,campaign.getName(),3,c);
    }
    else{
      allData[campaign.getName()]["QSBelow"] = "N/A";
      allData[campaign.getName()]["QSAverage"] = "N/A";
      allData[campaign.getName()]["QSAdBelow"] = "N/A";
      allData[campaign.getName()]["QSAdAverage"] = "N/A";
      allData[campaign.getName()]["QSLandingBelow"] = "N/A";
    }
    
    //Without negatives are only names of campaigns, it isnt necesary rewrite this information
    withOutNegatives(campaign);
    
    var headers = ["Campaign","AdGroup","términos de búsqueda con conversiones que NO están agregados en exacta"];
    writeHds(s, headers);
    var d = searchTerms(campaign);
    Logger.log("lolo " +d)
    writeColumn(s,campaign.getName(),3,d);
    
    searchTermsClicks(campaign);
    
    searchTermsNegatives(campaign);
    
    //writeInSheet(s, campaign.getName(), obj);
  }
  
  //var woNegatives = 
  //var shouldBeInExact =     
  //var noExactKws = 
  //var shouldbeNegatives = 
  //var repeated = repeatedKeywords();
}

////////////////////////////////////////////////////////////////////////// HERE FINISH KEYWORDS DATA AND START ADS DATA ////////////////////////////////////////////////////////////////////

function lessTwoActiveAds(campaign) {
   var adGroups = [];
 
  
    if(campaign.getName() == "AW_DO_SEM_MPNs")
      return;
  
    var adgroups = campaign.adGroups().withCondition('Status = ENABLED').get();
    while(adgroups.hasNext()) {
      var adg = adgroups.next();
      var ads = adg.ads()
        .withCondition("Status = ENABLED")
        .get()
      if(ads.totalNumEntities() < 2) {
        var adgroup = {
          campaign : campaign.getName(),
          adGroup : adg.getName(),
          ads : ads.totalNumEntities(),
        };
        adGroups.push(adgroup);
      }
    }
    allData[campaign.getName()]["less2ads"] = adGroups.length;
   
  return adGroups;  
}

//anuncios con mas de 200 dias activos
function oldETAAds(campaign) {
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
      ' AND CampaignId = '+campaign.getId()+
      ' DURING '+dateRange);
  
  var rows = report.rows();
  while(rows.hasNext()){
    var row = rows.next();

    var ids = [[row['AdGroupId'],row['Id']]]; 
    var ads = campaign.ads().withIds(ids).get().next();
    var  ad = {
      title : ads.getHeadline(),
      adGroup : ads.getAdGroup(),
      campaign : campaign.getName(),
     };
     oldAds.push(ad);

  }
  allData[campaign.getName()]["oldAds"] = oldAds.length;
  return oldAds;
}

function url404(campaign) {
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
  allData[campaign.getName()]["ads404"] = badUrls.length;
  return res;
}

function Ads() {
  for(i in activeCampaigns){
    var campaign = activeCampaigns[i];
    lessTwoActiveAds(campaign); 
    oldETAAds(campaign);
    url404(campaign);
  }
  //var lessTwoAds = 
  //var oldAds = 
  //var invalidUrls = 
}

//////////////////////////////////////////////////////////////////////////////////////////////  HERE FINISH ADS AND START EXTENSIONS PERFORMANCE REPORT   ///////////////////////////////

function activeSiteLinks(campaign) {
  var less4sitelinks = [];
  var temp = [];
  
   allData[campaign.getName()]["less4sitelinks"] = 0;
  
    var sitelinks = campaign.extensions().sitelinks().get();
    var count = 0;
    if(sitelinks.totalNumEntities() == 0){
      if(less4sitelinks.indexOf(campaign) == -1){
        less4sitelinks.push(campaign);
         allData[campaign.getName()]["less4sitelinks"] = less4sitelinks.length;
      }
      return;
    }
    while(sitelinks.hasNext()){
      var sitelink = sitelinks.next();
      var impressions_yes = sitelink.getStatsFor("YESTERDAY").getImpressions();
      var impressions_tod = sitelink.getStatsFor("TODAY").getImpressions();
      if(impressions_yes > 0 && impressions_tod > 0)
        count++;
    }
    if(count < 4 )
      if(less4sitelinks.indexOf(campaign) == -1)
        less4sitelinks.push(campaign);
    Logger.log(campaign.getName())
    allData[campaign.getName()]["less4sitelinks"] = less4sitelinks.length;
  return less4sitelinks;
}


function activeCallouts2(campaign) {
  var inactive = [];
 
    var callouts = campaign.extensions().callouts().get();
   
    var count = 0;
    if(callouts.totalNumEntities() == 0){
      if(inactive.indexOf(campaign) == -1){
        inactive.push(campaign);
        allData[campaign.getName()]["less2callouts"] = "X"; 
      }
      return;
    }
    while(callouts.hasNext()){
      var callout = callouts.next();
      var impressions_yes = callout.getStatsFor("YESTERDAY");
      var impressions_tod = callout.getStatsFor("TODAY");
      if(impressions_yes > 0 && impressions_tod > 0)
        count++;
    }
  if(count < 2){
      inactive.push(campaign);
     allData[campaign.getName()]["less2callouts"] = "X";
  }else
    allData[campaign.getName()]["less2callouts"] = "OK";
   

  return inactive;
}

function siteLinksWODesc(campaign){
  var withoutDesc = [];
  
    var sitelinks = campaign.extensions().sitelinks().get();
    while(sitelinks.hasNext()){
      var sitelink = sitelinks.next();
      var description1 = sitelink.getDescription1();
      var description2 = sitelink.getDescription2();
      
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
  allData[campaign.getName()]["SLsindesc"] = withoutDesc.length;
  return withoutDesc;
}

function Extensions() {
  for(i in activeCampaigns){
    var campaign = activeCampaigns[i];
    activeSiteLinks(campaign);
    activeCallouts2(campaign);
    siteLinksWODesc(campaign);
  }

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

function manualCPC(campaign) {
  var campaignsManualCPC = [];
    
  var type = campaign.bidding().getStrategyType();
  if(type == "MANUAL_CPC"){
    campaignsManualCPC.push(campaign.getName());
    allData[campaign.getName()]["manualCPC"] = "OK";  
  }else
    allData[campaign.getName()]["manualCPC"] = "X";

  return campaignsManualCPC;
}

function adGroupsOverCPA(campaign) {
  var over = [];
  
    var adGroups = campaign.adGroups()
      .withCondition("Status = ENABLED")
      .withCondition("Cost > "+3*targetCPA+'')
      .withCondition("Impressions = 0")
      .forDateRange("LAST_MONTH")
      .get();
    while(adGroups.hasNext()){
      var adGroup = adGroups.next();
      over.push(adGroup);    
    }
    allData[campaign.getName()]["adGoverCPA"] = over.length;

  return over;
}

function costPerConversion(campaign) {
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
  allData[campaign.getName()]["adGCostperConversion"] = adgroupsOver.length;
  return adgroupsOver;
}

function costPerConversion7days(campaign) {
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
  allData[campaign.getName()]["aGover7days"] = overDuring7days.length;
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

function geoCampaign(campaign) {
  var countries = [];
  
    var id = campaign.getId();
    
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
    allData[campaign.getName()]["locations"] = countries.length;

  return countries;
}

function genreCampaign(campaign) {
  var obj = {};
 
    var id  = campaign.getId();
    
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
    Logger.log(obj)
    var c=0;
    for(k in obj)
      c++;
    allData[campaign.getName()]["generos"] = c;

  return obj;
}

function daysOfTheWeek(campaign) {
  var response = [];
 
    var id = campaign.getId();

    
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
      Logger.log(row['DayOfWeek']+"  "+cost);
      if(parseFloat(cost) > 3*targetCPA)
        daysof.push(row['DayOfWeek']);
    }
    Logger.log(daysof)
    var obj = {
      campaign : campaign.getName(),
      days : daysof,
    };
    response.push(obj);
    allData[campaign.getName()]["daysofWeek"] = daysof.length;

  return response;
}


function hoursOfDay(campaign) {
  var response = [];
  
    var id = campaign.getId();
    
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
    allData[campaign.getName()]["hoursofDay"] = hours.length;
    

  return response;
}


function Bids() {
  for(i in activeCampaigns){
    var campaign = activeCampaigns[i];
    if(isBrand(campaign.getName())){
      allData[campaign.getName()]["manualCPC"] = "N/A";
      allData[campaign.getName()]["adGoverCPA"] = "N/A";
      allData[campaign.getName()]["adGCostperConversion"] = "N/A";
      allData[campaign.getName()]["aGover7days"] = "N/A";
      allData[campaign.getName()]["locations"] = "N/A";
      allData[campaign.getName()]["generos"] = "N/A";
      allData[campaign.getName()]["daysofWeek"] = "N/A";
      allData[campaign.getName()]["hoursofDay"] = "N/A";
    }else{
       manualCPC(campaign);  
       adGroupsOverCPA(campaign);
       costPerConversion(campaign);
       costPerConversion7days(campaign);
       geoCampaign(campaign);
       genreCampaign(campaign); 
       daysOfTheWeek(campaign);
       hoursOfDay(campaign);
    }
   
  }
   
  //var d = 
}

//////////////////////////////////////////////////////////////////////////////////////     HERE FINISH BIDS FUNCTIONS ////////////////////////////////////////////////


function writeHeaders(s) {
  var headers = ['','SETTINGS','KEYWORDS & QS','ADS','EXTENSIONS','BIDS'];
  var columns = [3,4,11,3,3,9];
 
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
               'adRelevance avg','quality landing below avg','campsñas sin neg','serch terms and no exact','searchTerm CTR > 10%, Clicks > 10',
               'searchTerms con CTR < 1%, Impr > 200 '],
    ads : ['AG less 2 adds active','old ads','ads 404'],
    extensions : ['less 4 sitelinks active','less 2 callouts active','SL sin descrp.'],
    bids : ['cpc manual','AG costo > 3xCPAobj sin conv','AG cost/conv > 3xCPAobj','adgroups con Costo/Conv last 7 days',
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


function initSpreadsheet() {
  var spreadsheet = SpreadsheetApp.openByUrl(CONFIG.SPREADSHEET_URL);
  
  if (CONFIG.COPY_SPREADSHEET) 
    spreadsheet = spreadsheet.copy('Audit Script');
  
  clearContent(spreadsheet);
  
  writeHeaders(spreadsheet);
  
  writeSecondHeaders(spreadsheet);

  return spreadsheet;
}

function writeDataGeneral(s) {
  var sheet = s.getSheetByName("general");
  var row = 3;
 
  for(k in allData){
    var range = sheet.getRange(row,1,1,3);
    var column = 4;
    range.setValue(k).mergeAcross().setHorizontalAlignment('center');
 
    for(kk in allData[k]){
        var r = sheet.getRange(row,column);
        r.setValue(allData[k][kk]).setHorizontalAlignment('center');
        column++;
    }
    row++;
  }
}

function writeInSheet(s, campaign, obj) {
  var row = s.getLastRow()+1;
  var r = s.getRange(row,1);
  var values = [obj.data];
  r.setValue(campaign).setHorizontalAlignment('center').setWrap(true);
  r = s.getRange(row,2,1,obj.data.length);
  r.setValues(values);
}

function writeHds(s,h) {
  var row = s.getLastRow()+2;
  Logger.log(row)
  for(var i=0; i <  h.length; i++){
    var r = s.getRange(row,i+1);
    r.setValue(h[i]).setFontSize(14).setHorizontalAlignment('center').setWrap(true);
  }
}

function writeColumn(s,campaign,column, data) { //column start at 3 cause 1 and 2 are campaign and adgroup 
  var rowdata = s.getLastRow()+1;
  
  for(var i = 0; i < data.data.length ; i++,rowdata++){
     var range = s.getRange(rowdata,column);
     range.setValue(data.data[i]).setHorizontalAlignment('center').setWrap(true); 
     range = s.getRange(rowdata,1);
     range.setValue(campaign).setHorizontalAlignment('center').setWrap(true); 
     range = s.getRange(rowdata,2);
     range.setValue(data.adgroups[i]).setHorizontalAlignment('center').setWrap(true); 
  }

}
  
function main() {  
   fillActiveCampaigns();
   var spreadsheet = initSpreadsheet();
   var sheet = spreadsheet.getSheetByName("settings");
   Settings(sheet);  
   sheet = spreadsheet.getSheetByName("kw & QS");
   KeyWords(sheet);
   Ads();
   Extensions();
   Bids()
   writeDataGeneral(spreadsheet);
  
}
