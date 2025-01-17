'use strict';

import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';
import * as _ from 'lodash';
import { PurchasingOrderReportModel } from '../models/reports/purchasingOrder';
import { RequisitionOrderReportModel } from '../models/reports/requisitionOrder';


const model = new PurchasingOrderReportModel();
const modelPr = new RequisitionOrderReportModel();
const router = express.Router();

const path = require('path')
const fse = require('fs-extra');
const fs = require('fs');
const json2xls = require('json2xls');

let chief = "ปฎิบัติราชการแทนผู้ว่าราชการจังหวัด";
// moment.locale('th');
// const printDate = 'วันที่พิมพ์ ' + moment().format('D MMMM ') + (moment().get('year') + 543) + moment().format(', HH:mm:ss น.');

function printDate() {
  moment.locale('th');
  const printDate = 'วันที่พิมพ์ ' + moment().format('D MMMM ') + (moment().get('year') + 543) + moment().format(', HH:mm:ss น.');
  return printDate
}

router.get('/', (req, res, next) => {
  res.send({ ok: true, message: 'Welcome to Purchasing API server' });
});

router.get('/version', (req, res, next) => {
  res.send({ ok: true, version: 'v1.0.0', build: '20170603' });
});

router.get('/report/purchasingorder', wrap(async (req, res, next) => {
  let purchasOrderId = req.query.porder;
  let db = req.db;


  let results = await model.purchasingOrder(db, purchasOrderId)
  results = results[0]
  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let getchief = await model.purchasing2Chief(db, purchasOrderId);
  getchief = getchief[0].chief_fullname;
  let hospname = await model.hospital(db)
  hospname = hospname[0].hospname
  let date = model.prettyDate(results[0].order_date)
  let lname = results[0].labeler_name
  let sum: any = 0;
  let chief = 0;
  let pid = results[0].purchase_order_number
  let poraor = hospname[0].managerName

  results.forEach(value => {
    value.qty = model.commaQty(value.qty);
    value.small_qty = model.commaQty(value.small_qty);
    sum += value.total;
    value.unit = model.comma(value.unit);
    value.total = model.comma(value.total);
  });
  let sumtext = model.bahtText(sum);
  sum = model.comma(sum);
  if (sumtext == null || pid == null || hospname == null || results == null || lname == null || date == null || sum == null)
    res.render('error404')

  let cposition = await model.getPosition(db, results[0].chief_id);

  res.render('purchase_order_single', {
    chief: chief,
    cposition: cposition[0],
    sumtext: sumtext,
    pid: pid,
    hospname: hospname,
    pOrder: results,
    lname: lname,
    date: date,
    sum: sum,
    getchief: getchief
  });
}));

router.get('/report/requisitionorder/:orderId', wrap(async (req, res, next) => {
  let db = req.db;
  let orderId = req.params.orderId;

  let detail: any[] = await modelPr.requisitionItem(db, orderId);
  let detail1: any[] = await modelPr.name(db, orderId);
  let hospname = await model.hospital(db);
  hospname = hospname[0].hospname
  detail = detail[0]
  detail1 = detail1[0]
  if (detail === undefined) res.render('error404')
  if (detail1 === undefined) res.render('error404')
  let date = model.prettyDate(detail[0].order_date);
  let lname = (detail[0].labeler_name)
  let bgname = (detail[0].bgtype_name)
  let requisitionItem = detail;
  let name = detail1;

  res.render('requisition_order', { hospname: hospname, requisitionItem: requisitionItem, date: date, name: name, lname: lname, bgname: bgname });
}));

router.get('/report/agree', wrap(async (req, res, next) => {
  let db = req.db;
  let hospname = await model.hospital(db);

  hospname = hospname[0].hospname
  res.render('agree', { hospname: hospname })
}));

router.get('/report/purchase', wrap(async (req, res, next) => {
  res.render('purchase')
}));

router.get('/report/purchaseRequset', wrap(async (req, res, next) => {
  res.render('purchaseRequset')
}));

router.get('/report/list/purchaseSelec', wrap(async (req, res, next) => {
  let generic_type_id = req.query.generic_type_id;
  let warehouseId = req.decoded.warehouseId;

  let db = req.db;

  let results = await model.getOrderPoint(db, warehouseId, generic_type_id);
  let hospname = await model.hospital(db);
  results = results[0]
  if (results[0] === undefined) res.render('error404')
  hospname = hospname[0].hospname
  let nDate = model.prettyDate(new Date())
  let i = 0;
  let fill = [];
  results.forEach(value => {
    fill[i] = ((value.max_qty - value.remain_qty) / value.qty).toFixed(0);
    fill[i] < 0 ? fill[i] = 1 : fill[i];
    value.remain_qty = (value.remain_qty / value.qty).toFixed(0);
    if (value.qty === null) value.qty = 0
    if (value.min_qty === null) value.min_qty = 0
    i++;
  });

  moment.locale('th');
  let sdate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543);

  res.render('listpurchase', { fill: fill, nDate: nDate, hospname: hospname, results: results, sdate: sdate })
}));

router.get('/report/list/purchase-trade-select', wrap(async (req, res, next) => {
  let product_id = req.query.product_id;
  let warehouseId = req.decoded.warehouseId;

  let db = req.db;

  let results = await model.getSelectOrderPoint(db, warehouseId, product_id);
  let hospname = await model.hospital(db);
  results = results[0]
  if (results[0] === undefined) res.render('error404')
  hospname = hospname[0].hospname
  let nDate = model.prettyDate(new Date())
  let i = 0;
  let fill = [];
  results.forEach(value => {
    fill[i] = ((value.max_qty - value.remain_qty) / value.qty).toFixed(0);
    fill[i] < 0 ? fill[i] = 1 : fill[i];
    value.remain_qty = (value.remain_qty / value.qty).toFixed(0);
    if (value.qty === null) value.qty = 0
    if (value.min_qty === null) value.min_qty = 0
    i++;
  });
  moment.locale('th');
  let sdate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543);

  res.render('listpurchase', { fill: fill, nDate: nDate, hospname: hospname, results: results, sdate: sdate })
}));

router.get('/report/list/purchase/:startdate/:enddate', wrap(async (req, res, next) => {
  let startdate = req.params.startdate;
  let enddate = req.params.enddate;
  let db = req.db;
  let results = await model.lPurchase(db, startdate, enddate);
  let hospname = await model.hospital(db);
  results = results[0]
  if (results[0] === undefined) res.render('error404')
  hospname = hospname[0].hospname
  let nDate = model.prettyDate(new Date())
  results.forEach(value => {
    if (value.qty === null) value.qty = 0
    if (value.min_qty === null) value.min_qty = 0
  });
  moment.locale('th');
  let sdate = moment(startdate).format('D MMMM ') + (moment(startdate).get('year') + 543);
  let edate = moment(enddate).format('D MMMM ') + (moment(enddate).get('year') + 543);

  res.render('listpurchase', { nDate: nDate, hospname: hospname, results: results, sdate: sdate, edate: edate })
}));

router.get('/report/total/purchase/:createDate', wrap(async (req, res, next) => {
  let createDate = req.params.createDate;
  let db = req.db;
  let nDate = createDate
  createDate = '%' + createDate + '%'

  let results = await model.tPurchase(db, createDate);
  let hospname = await model.hospital(db);
  results = results[0]
  hospname = hospname[0].hospname
  moment.locale('th')
  nDate = moment(nDate).format('MMMM ') + (moment(nDate).get('year') + 543);
  let sum = 0
  results.forEach(value => {
    value.created_date = model.prettyDate(value.created_date);
    sum += value.total_price
    value.total_price = (value.total_price).toFixed(2)
  });

  res.render('totalpurchase', {
    nDate: nDate,
    hospname: hospname,
    results: results,
    sum: sum.toFixed(2)
  })
}));

router.get('/report/type/purchase', wrap(async (req, res, next) => {
  res.render('typepurchase')
}));

router.get('/report/month/purchase', wrap(async (req, res, next) => {
  let month = req.params.month;
  let db = req.db;

  let results = await model.mPurchase(db);
  let hospname = await model.hospital(db);
  results = results[0]
  hospname = hospname[0].hospname
  let nDate = model.prettyDate(new Date())
  // let date = model.prettyDate(results[0].created_date);
  let sum = 0
  let sum1 = 0
  results.forEach(value => {
    if (value.generic_type_id == 1) sum += value.amount
    if (value.generic_type_id > 1) sum1 += value.amount
  });
  let total = sum + sum1;

  res.render('monthpurchase', { nDate: nDate, total: total, results: results, hospname: hospname, sum: sum, sum1: sum1 })
}));

router.get('/report/process/purchase/:startdate/:enddate', wrap(async (req, res, next) => {
  let startdate = req.params.startdate;
  let enddate = req.params.enddate;
  let db = req.db;
  let results = await model.pPurchase(db, startdate, enddate);
  let hospname = await model.hospital(db);
  results = results[0]
  hospname = hospname[0].hospname
  let nDate = model.prettyDate(new Date())
  moment.locale('th');
  let dates = moment(startdate).format('D MMMM ') + (moment(startdate).get('year') + 543);
  let daten = moment(enddate).format('D MMMM ') + (moment(enddate).get('year') + 543);
  let sum = 0
  let sum1 = 0
  let sum2 = 0

  results.forEach(value => {
    sum += value.po
    sum1 += value.list
    sum2 += value.cost
    value.cost = (value.cost).toFixed(2)
  });

  res.render('processpurchase', {
    results: results,
    hospname: hospname,
    daten: daten,
    dates: dates,
    sum: sum,
    sum1: sum1,
    sum2: sum2
  })
}));

router.get('/report/purchasing', wrap(async (req, res, next) => {
  let startdate = req.query.startdate;
  // let enddate = req.params.enddate;
  let db = req.db;
  let results = await model.pPurchasing(db, moment(startdate).format('YYYY-MM-DD'));
  let hospname = await model.hospital(db);
  results = results[0]
  hospname = hospname[0].hospname
  moment.locale('th');
  let sdate = moment(startdate).format('D MMMM ') + (moment(startdate).get('year') + 543);
  // let edate = moment(enddate).format('D MMMM ') + (moment(enddate).get('year') + 543);
  let nDate = moment(new Date()).format('DD MMMM YYYY');
  let dates = moment(startdate).format('MMMM');
  // let daten = moment(enddate).format('MMMM');
  let sum: any = 0;

  results.forEach(value => {
    sum += value.total_price
    value.order_date = moment(value.order_date).format('DD/MM/YYYY')
    value.unit_price = model.comma(value.unit_price)
    value.conversion = model.commaQty(value.conversion)
    value.qty = model.commaQty(value.qty)
    value.total_price = model.comma(value.total_price)
  });
  sum = model.comma(sum)

  res.render('pPurchasing', {
    results: results,
    hospname: hospname,
    sum: sum,
    sdate: sdate,
  })
}));

router.get('/report/purchasing-list', wrap(async (req, res, next) => {
  let startdate = req.query.startDate;
  let enddate = req.query.endDate;
  let generic_type_id = req.query.genericTypeId;
  let db = req.db;
  let results = await model.PurchasingList(db, startdate, enddate, generic_type_id);
  let hospname = await model.hospital(db);
  if (!results[0].length) { res.render('error404') };
  results = results[0]
  hospname = hospname[0].hospname
  moment.locale('th');
  let sdate = moment(startdate).format('D MMMM ') + (moment(startdate).get('year') + 543);
  let edate = moment(enddate).format('D MMMM ') + (moment(enddate).get('year') + 543);
  // let nDate = moment(new Date()).format('DD MMMM YYYY');
  let dates = moment(startdate).format('MMMM');
  let daten = moment(enddate).format('MMMM');
  let sum: any = 0;

  results.forEach(value => {
    sum += value.total_price;
    value.order_date = moment(value.order_date).isValid() ? moment(value.order_date).format('DD/MM/') + (moment(value.order_date).get('year') + 543) : '-';
    value.delivery_date = moment(value.delivery_date).isValid() ? moment(value.delivery_date).format('DD/MM/') + (moment(value.delivery_date).get('year') + 543) : '-';
    value.unit_price = model.comma(value.unit_price)
    value.conversion = model.commaQty(value.conversion)
    value.qty = model.commaQty(value.qty)
    value.total_price = model.comma(value.total_price)
  });
  sum = model.comma(sum)

  res.render('pPurchasingList', {
    results: results,
    hospname: hospname,
    daten: daten,
    dates: dates,
    sum: sum,
    printDate: printDate(),
    sdate: sdate,
    edate: edate
  })
}));

router.get('/report/purchasing/:startdate/:enddate/:bgtypeId/:status', wrap(async (req, res, next) => {
  let startdate = req.params.startdate;
  let enddate = req.params.enddate;
  let bgtypeId = req.params.bgtypeId;
  let status = req.params.status;
  let db = req.db;
  let results = await model.Purchasing(db, startdate, enddate, bgtypeId, status);

  let hospname = await model.hospital(db);
  results = results[0]
  hospname = hospname[0].hospname
  moment.locale('th');
  let sdate = moment(startdate).format('D MMMM ') + (moment(startdate).get('year') + 543);
  let edate = moment(enddate).format('D MMMM ') + (moment(enddate).get('year') + 543);
  let nDate = moment(new Date()).format('DD MMMM YYYY');
  let dates = moment(startdate).format('MMMM');
  let daten = moment(enddate).format('MMMM');
  let sum: any = 0;

  results.forEach(value => {
    sum += value.total_price
    value.order_date = moment(value.order_date).format('DD/MM/YYYY')
    value.unit_price = model.comma(value.unit_price)
    value.conversion = model.commaQty(value.conversion)
    value.qty = model.commaQty(value.qty)
    value.total_price = model.comma(value.total_price)
  });
  sum = model.comma(sum)

  res.render('pPurchasing', {
    results: results,
    hospname: hospname,
    daten: daten,
    dates: dates,
    sum: sum,
    nDate: nDate,
    sdate: sdate,
    edate: edate
  })
}));

router.get('/report/totalcost/purchase/:month', wrap(async (req, res, next) => {
  let db = req.db
  let month = req.params.month
  if (month.length == 1) month = '0' + month
  // console.log(month)
  let year = moment(new Date()).get('year') + 543
  let years = moment(new Date()).get('year')
  let smonth = years + '-' + month + '-01'
  let emonth = years + '-' + month + '-31'

  let type1 = await model.sumType1(db, smonth, emonth)
  let type2 = await model.sumType2(db, smonth, emonth)
  type1 = type1[0]
  type2 = type2[0]
  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543);
  let thmonth = moment(month).format('MMMM')
  let sum: any = 0
  type1.forEach(v => {
    sum += v.total_price
    if (v.total_price == null) v.total_price = 0
    v.total_price = model.comma(v.total_price)
  });
  type2.forEach(v => {
    sum += v.total_price
    if (v.total_price == null) v.total_price = 0
    v.total_price = model.comma(v.total_price)
  });

  sum = model.comma(sum)
  res.render('totalcostpurchase', {
    type1: type1,
    type2: type2,
    hospname: hospitalName,
    nDate: nDate,
    thmonth: thmonth,
    year: year,
    sum: sum
  })
}));

router.get('/test', wrap(async (req, res, next) => {
  let db = req.db;
  moment.locale('th');
  let purchaOrderId = req.query.purchase_order_id;
  let type = req.query.type;
  let purchasing = await model.purchasing(db, purchaOrderId);
  purchasing = purchasing[0];
  let committeesVerify = await model.getCommitteeVerify(db, purchasing.verify_committee_id);
  let committeesCheck = await model.getCommitteeVerify(db, purchasing.check_price_committee_id);
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let orderDate = moment(purchasing.order_date).format('D MMMM ') + (moment(purchasing.order_date).get('year') + 543);

  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let inventoryBossName = _.find(purchasingOfficer, { 'type_id': 2 });
  let directorName = _.find(purchasingOfficer, { 'type_id': 1 });
  res.render('test', {
    committeesVerify: committeesVerify,
    committeesCheck: committeesVerify,
    hospitalName: hospitalName,
    orderDate: orderDate,
    purchasing: purchasing,
    type: type,
    pricetext: model.bahtText(purchasing.total_price) || 0,
    count: count,
    purchasingOfficer: purchasingOfficer,
    inventoryBossName: inventoryBossName,
    directorName: directorName

  });
}));

router.get('/report/purchasing/1/:purchaOrderId/:type', wrap(async (req, res, next) => {
  let db = req.db;
  let type = req.params.type;
  let purchaOrderId = req.params.purchaOrderId;

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let purchasing = await model.purchasing(db, purchaOrderId);

  purchasing = purchasing[0];
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0];
  count = count[0].count;
  let pricetext = model.bahtText(purchasing[0].total_price);
  let committee = await model.getCommitteeVerify(db, purchasing.verify_committee_id);

  committee = committee[0];
  let committee1 = committee ? committee[0].title_name + committee[0].fname + ' ' + committee[0].lname + ' ' + committee[0].position2 + ' เป็น' + committee[0].position_name : '';
  let committee2 = committee ? committee[1].title_name + committee[1].fname + ' ' + committee[1].lname + ' ' + committee[1].position2 + ' เป็น' + committee[1].position_name : '';
  let committee3 = committee ? committee[2].title_name + committee[2].fname + ' ' + committee[2].lname + ' ' + committee[2].position2 + ' เป็น' + committee[2].position_name : '';

  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543);

  let committeecheck = await model.purchasingCommitteeCheck(db, purchaOrderId);
  committeecheck = committeecheck[0];
  let committeecheck1 = committeecheck ? committeecheck[0].title_name + committeecheck[0].fname + ' ' + committeecheck[0].lname : '';
  let committeecheckpos1 = committeecheck ? committeecheck[0].position2 : '';
  let committeecheck2 = committeecheck ? committeecheck[1].title_name + committeecheck[1].fname + ' ' + committeecheck[1].lname : '';
  let committeecheckpos2 = committeecheck ? committeecheck[1].position2 : '';
  let committeecheck3 = committeecheck ? committeecheck[2].title_name + committeecheck[2].fname + ' ' + committeecheck[2].lname : '';
  let committeecheckpos3 = committeecheck ? committeecheck[2].position2 : '';

  purchasing.forEach(value => {
    value.total_price = model.comma(value.total_price);
  })

  res.render('purchasing', {
    hospitalName: hospitalName,
    type: type,
    purchasing: purchasing,
    count: count,
    pricetext: pricetext,
    nDate: nDate,
    committee1: committee1,
    committee2: committee2,
    committee3: committee3,
    committeecheck1: committeecheck1,
    committeecheck2: committeecheck2,
    committeecheck3: committeecheck3,
    committeecheckpos1: committeecheckpos1,
    committeecheckpos2: committeecheckpos2,
    committeecheckpos3: committeecheckpos3
  });
}));

router.get('/report/purchasing/2', wrap(async (req, res, next) => {
  let db = req.db;
  let purchaOrderId = req.query.purchaOrderId;
  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let purchasing2 = await model.purchasing2Chief(db, purchaOrderId);
  let committee = await model.purchasingCommittee(db, purchaOrderId);
  committee = committee[0];
  let committee1 = committee[0].title_name + committee[0].fname + ' ' + committee[0].lname;
  let committee1p = committee[0].position_name;
  let committee2 = committee[1].title_name + committee[1].fname + ' ' + committee[1].lname;
  let committee2p = committee[1].position_name;
  let committee3 = committee[2].title_name + committee[2].fname + ' ' + committee[2].lname;
  let committee3p = committee[2].position_name;
  res.render('purchasing2', {
    hello: 'hello', hospitalName: hospitalName, purchasing2: purchasing2[0]
    , committee1: committee1, committee2: committee2, committee3: committee3
    , committee1p: committee1p, committee2p: committee2p, committee3p: committee3p
  });
}));

router.get('/report/purchasing/3', wrap(async (req, res, next) => {
  let db = req.db;
  let type = req.query.type;
  let bgtype = req.query.bgtype;
  let bgtypesub = req.query.bgtypesub;
  let purchaOrderId = req.query.purchaOrderId;

  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId)

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName
  let purchasing = await model.purchasing3(db, purchaOrderId);
  purchasing = purchasing[0];
  let committeesVerify = await model.getCommitteeVerify(db, purchasing[0].verify_committee_id);
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;
  let at = await model.at(db)//book_prefix
  at = at[0]
  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)
  let year = moment(new Date).get('year') + 544

  let budget = await model.budgetType(db, purchasing[0].budget_detail_id)
  budget = budget[0]
  let totalprice = 0

  let sum = model.comma(budget[0].amount - budget[0].order_amt)
  budget.forEach(value => {
    value.amount = model.comma(value.amount)
    value.order_amt = model.comma(value.order_amt)
  });

  purchasing.forEach(value => {
    totalprice += value.total_price
    if (value.qty == null) value.qty = 0;
    value.qty = model.commaQty(value.qty);
    value.qtyPoi = model.commaQty(value.qtyPoi);
    value.total_price = model.comma(value.total_price);
    value.unit_price = model.comma(value.unit_price);
    value.total = model.commaQty(value.total)
  })
  let ttotalprice = model.comma(totalprice)
  let bahtText = model.bahtText(totalprice)
  res.render('purchasing3', {
    type: type,
    purchasing: purchasing,
    sum: sum,
    total: ttotalprice,
    hospitalName: hospitalName,
    at_name: at[0].value,
    nDate: nDate,
    committeesVerify: committeesVerify,
    bahtText: bahtText,
    budget: budget,
    poraor: poraor,
    purchasingChief: purchasingChief[0],
  });
}));

router.get('/report/purchasing/4', wrap(async (req, res, next) => {
  let db = req.db;
  let purchaOrderId = req.query.purchaOrderId

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let province = hosdetail[0].province;

  moment.locale('th');
  let today = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)
  let purchasing4 = await model.purchasing4(db, purchaOrderId);
  let total_price = model.comma(purchasing4[0].total_price);
  let total_priceT = model.bahtText(purchasing4[0].total_price);
  let date = moment(purchasing4[0].order_date).format('D MMMM ') + (moment(purchasing4[0].order_date).get('year') + 543)
  let getChief = await model.getChief(db, '1');
  res.render('purchasing4', {
    hello: 'hello',
    hospitalName: hospitalName,
    today: today,
    purchasing4: purchasing4,
    total_price: total_price,
    total_priceT: total_priceT,
    date: date,
    getChief: getChief[0],
    province: province
  });
}));

router.get('/report/purchasing/5', wrap(async (req, res, next) => {
  let db = req.db;
  let purchaOrderId = req.query.purchaOrderId

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let province = hosdetail[0].province;

  moment.locale('th');
  let today = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)
  let purchasing5 = await model.purchasing5(db, purchaOrderId);
  let total_price = model.comma(purchasing5[0].total_price);
  let total_priceT = model.bahtText(purchasing5[0].total_price);
  let date = moment(purchasing5[0].order_date).format('D MMMM ') + (moment(purchasing5[0].order_date).get('year') + 543)
  let getChief = await model.getChief(db, '1');
  let committee = await model.purchasingCommittee(db, purchaOrderId);
  committee = committee[0];
  res.render('purchasing5', {
    hello: 'hello',
    hospitalName: hospitalName,
    today: today,
    purchasing5: purchasing5,
    total_price: total_price,
    total_priceT: total_priceT,
    date: date,
    getChief: getChief[0],
    province: province, committee: committee
  });
}));

router.get('/report/purchasing/6', wrap(async (req, res, next) => {
  let db = req.db;
  let purchaOrderId = req.query.purchaOrderId

  let getChief = await model.getChief(db, '4')
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId)
  let buyer_fullname = purchasingChief[0].buyer_fullname
  let chief_fullname = purchasingChief[0].chief_fullname
  let buyer_position = purchasingChief[0].buyer_position
  let chief_position = purchasingChief[0].chief_position
  let nameChief = getChief[0].title + " " + getChief[0].fname + "  " + getChief[0].lname
  let hosdetail = await model.hospital(db);
  let results = await model.purchasing3(db, purchaOrderId);
  let committee = await model.purchasingCommittee(db, purchaOrderId);
  let at = await model.at(db)
  at = at[0]
  results = results[0]
  let hospitalName = hosdetail[0].hospname;
  let province = hosdetail[0].province
  let name = results[0].name
  let at_name = at[0].value;
  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)
  let year = moment(new Date).get('year') + 543
  let budgetYear = await model.budgetYear(db, year)
  let amount_budget = budgetYear[0].amount
  let labeler_name = results[0].labeler_name
  let labeler_name_po = results[0].labeler_name_po
  committee = committee[0];
  let committee1 = committee[0].title_name + committee[0].fname + ' ' + committee[0].lname + ' ' + committee[0].position2 + ' เป็น' + committee[0].position_name;
  let committee2 = committee[1].title_name + committee[1].fname + ' ' + committee[1].lname + ' ' + committee[1].position2 + ' เป็น' + committee[1].position_name;
  let committee3 = committee[2].title_name + committee[2].fname + ' ' + committee[2].lname + ' ' + committee[2].position2 + ' เป็น' + committee[2].position_name;

  let totalprice = 0

  results.forEach(value => {
    totalprice += value.total_price
    value.qty = model.commaQty(value.qty);
    value.total_price = model.comma(value.total_price);
    value.unit_price = model.comma(value.unit_price);
    value.p_cost = model.comma(value.p_cost);
    value.total = model.commaQty(value.total)
  })

  let bahtText = model.bahtText(totalprice)
  let t_totalprice = model.comma(totalprice)
  amount_budget = model.comma(amount_budget)

  res.render('purchasing6', {
    hello: 'hello',
    year: year,
    hospitalName: hospitalName,
    at_name: at_name,
    nDate: nDate,
    results: results,
    committee1: committee1,
    committee2: committee2,
    committee3: committee3,
    totalprice: t_totalprice,
    bahtText: bahtText,
    amount_budget: amount_budget,
    nameChief: nameChief,
    buyer_fullname: buyer_fullname,
    buyer_position: buyer_position,
    chief_fullname: chief_fullname,
    chief_position: chief_position,
    province: province,
    labeler_name: labeler_name,
    labeler_name_po: labeler_name_po,
    name: name
  });
}));

router.get('/report/purchasing/7', wrap(async (req, res, next) => {
  let db = req.db;
  let purchaOrderId = req.query.purchaOrderId

  let getChief = await model.getChief(db, '4')
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId)
  let buyer_fullname = purchasingChief[0].buyer_fullname
  let chief_fullname = purchasingChief[0].chief_fullname
  let buyer_position = purchasingChief[0].buyer_position
  let chief_position = purchasingChief[0].chief_position
  let nameChief = getChief[0].title + " " + getChief[0].fname + "  " + getChief[0].lname
  let hosdetail = await model.hospital(db);
  let results = await model.purchasing3(db, purchaOrderId);
  let committee = await model.purchasingCommittee(db, purchaOrderId);
  let at = await model.at(db)

  at = at[0]
  results = results[0]
  let hospitalName = hosdetail[0].hospname
  let address = hosdetail[0].address
  let province = hosdetail[0].province
  let name = results[0].name
  let at_name = at[0].value;
  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)
  let year = moment(new Date).get('year') + 543
  let budgetYear = await model.budgetYear(db, year)
  let amount_budget = budgetYear[0].amount
  let labeler_name = results[0].labeler_name
  let labeler_name_po = results[0].labeler_name_po
  let labeler_address = results[0].address
  let labeler_phone = results[0].phone
  let nin = results[0].nin
  let cid = results[0].contract_id

  let totalprice = 0

  results.forEach(value => {
    totalprice += value.total_price
    value.qty = model.commaQty(value.qty);
    value.total_price = model.comma(value.total_price);
    value.unit_price = model.comma(value.unit_price);
    value.p_cost = model.comma(value.p_cost);
    value.total = model.commaQty(value.total)
  })

  let bahtText = model.bahtText(totalprice)
  let t_totalprice = model.comma(totalprice)
  amount_budget = model.comma(amount_budget)

  res.render('purchasing7', {
    hello: 'hello',
    year: year,
    hospitalName: hospitalName,
    at_name: at_name,
    nDate: nDate,
    results: results,
    nin: nin,
    labeler_address: labeler_address,
    labeler_phone: labeler_phone,
    totalprice: t_totalprice,
    bahtText: bahtText,
    amount_budget: amount_budget,
    nameChief: nameChief,
    buyer_fullname: buyer_fullname,
    buyer_position: buyer_position,
    chief_fullname: chief_fullname,
    chief_position: chief_position,
    province: province,
    labeler_name: labeler_name,
    labeler_name_po: labeler_name_po,
    name: name,
    address: address,
    purchaOrderId: purchaOrderId,
    cid: cid
  })
}));

router.get('/report/purchasing/8', wrap(async (req, res, next) => {
  let db = req.db;
  let purchaOrderId = req.query.purchaOrderId

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let province = hosdetail[0].province;

  moment.locale('th');
  let today = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)
  let purchasing8 = await model.purchasing8(db, purchaOrderId);
  let total_price = model.comma(purchasing8[0].total_price);
  let total_priceT = model.bahtText(purchasing8[0].total_price);
  let date = moment(purchasing8[0].order_date).format('D MMMM ') + (moment(purchasing8[0].order_date).get('year') + 543)
  let getChief = await model.getChief(db, '1');
  let committee = await model.purchasingCommittee(db, purchaOrderId);
  committee = committee[0];
  res.render('purchasing8', {
    hello: 'hello',
    hospitalName: hospitalName,
    today: today,
    purchasing8: purchasing8,
    total_price: total_price,
    total_priceT: total_priceT,
    date: date,
    getChief: getChief[0],
    province: province,
    committee: committee
  });
}));

router.get('/report/purchasing/9/:startdate/:enddate', wrap(async (req, res, next) => {
  let db = req.db
  let startdate = req.params.startdate
  let enddate = req.params.enddate

  moment.locale('th');
  let today = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)
  let results = await model.purchasing9(db, startdate, enddate);
  results = results[0]
  results.forEach(value => {
    value.unit_price = model.comma(value.unit_price)
    value.qty = model.commaQty(value.qty)
    value.qty1 = model.commaQty(value.qty1)
    value.total_price = model.comma(value.total_price)
  })
  startdate = moment(startdate).format('D MMMM ') + (moment(startdate).get('year') + 543)
  enddate = moment(enddate).format('D MMMM ') + (moment(enddate).get('year') + 543)
  res.render('purchasing9', {
    results: results,
    startdate: startdate,
    enddate: enddate
  });
}));

router.get('/report/purchasing/10/', wrap(async (req, res, next) => {
  let db = req.db;
  let type = req.query.type;
  let purchaOrderId = req.query.purchaOrderId;

  let warehouseId = req.decoded.warehouseId;

  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId);

  let cposition
  if (purchasingChief[0].chief_id) {
    cposition = await model.getPosition(db, purchasingChief[0].chief_id);
    cposition = cposition[0]
  } else cposition = '';

  let bposition
  if (purchasingChief[0].buyer_id) {
    bposition = await model.getPosition(db, purchasingChief[0].buyer_id);
    bposition = bposition[0]
  } else bposition = '';

  let pcb = await model.pcBudget(db, purchaOrderId);

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName
  let purchasing = await model.purchasing10(db, purchaOrderId, warehouseId);
  purchasing = purchasing[0];
  let committeesVerify = await model.purchasingCommittee2(db, purchaOrderId);
  committeesVerify = committeesVerify[0];
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;
  let at = await model.at(db)//book_prefix
  at = at[0]
  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)
  let year = moment(new Date).get('year') + 1
  let budget = await model.budgetType(db, purchasing[0].budget_detail_id)
  budget = budget[0]
  let totalprice = 0

  let budgetsave = 0;
  budget.forEach(value => {
    budgetsave += value.amount;
    value.amount = model.comma(value.amount);
    value.order_amt = model.comma(value.order_amt);
  });

  purchasing.forEach(value => {
    value.standard_cost = value.standard_cost < value.unit_price ? value.unit_price : value.standard_cost;
    totalprice += value.total_price;
    if (value.qty == null) value.qty = 0;
    value.qty = model.commaQty(value.qty);
    value.qtyPoi = model.commaQty(value.qtyPoi);
    value.total_price = model.comma(value.total_price);
    value.unit_price = model.comma(value.unit_price);
    value.standard_cost = model.comma(value.standard_cost);
    value.total = model.commaQty(value.total)
    let year: number = +moment(value.order_date).get('year') + 543;
    value.order_date = moment(value.order_date).format('D MMMM ') + year;
  })

  pcb.forEach(value => {
    value.incoming_balance = model.comma(value.incoming_balance)
    value.amount = model.comma(value.amount)
    value.balance = model.comma(value.balance)
  })

  let ttotalprice = model.comma(totalprice)
  let bahtText = model.bahtText(totalprice)
  let _month: any = moment(new Date()).format('MM');
  let _year: any = moment(new Date()).get('year');
  if (_month >= 10) {
    _year = (_year + 1);
  }

  let sdate = (_year - 1) + '-10-01';
  let ldate = (_year) + '-9-30';
  let sumTotal = await model.getSumTotal(db, purchasing[0].budget_detail_id)
  sumTotal = sumTotal[0];
  let sum = model.comma(budgetsave - sumTotal[0].sum)
  sumTotal = model.comma(sumTotal[0].sum - totalprice)

  let getAmountTransaction = await model.allAmountTransaction(db, purchasing[0].budget_detail_id, _year, purchasing[0].purchase_order_id)
  getAmountTransaction = getAmountTransaction[0];
  let allAmount: any = getAmountTransaction[0].amount;
  allAmount = model.comma(allAmount);

  if (pcb[0] == null
    || type == null
    || purchasing == null
    || sum == null
    || hospitalName == null
    || at[0].value == null
    || nDate == null
    || committeesVerify == null
    || bahtText == null
    || budget == null
    || sumTotal == null
  )
    res.render('error404')
  res.render('purchasing10', {
    allAmount: allAmount,
    pcb: pcb[0],
    chief: chief,
    type: type,
    purchasing: purchasing,
    sum: sum,
    total: ttotalprice,
    hospitalName: hospitalName,
    at_name: at[0].value,
    nDate: nDate,
    committeesVerify: committeesVerify,
    bahtText: bahtText,
    budget: budget,
    poraor: poraor,
    purchasingChief: purchasingChief[0],
    sumTotal: sumTotal,
    cposition: cposition,
    bposition: bposition
  });
}));

router.get('/report/purchasing/standard', wrap(async (req, res, next) => {
  let db = req.db;
  let type = req.query.type;
  let purchaOrderId = req.query.purchaOrderId;

  let warehouseId = req.decoded.warehouseId;

  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId);

  let cposition
  if (purchasingChief[0].chief_id) {
    cposition = await model.getPosition(db, purchasingChief[0].chief_id);
    cposition = cposition[0]
  } else cposition = '';

  let bposition
  if (purchasingChief[0].buyer_id) {
    bposition = await model.getPosition(db, purchasingChief[0].buyer_id);
    bposition = bposition[0]
  } else bposition = '';

  let pcb = await model.pcBudget(db, purchaOrderId);

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName
  let purchasing = await model.purchasing10(db, purchaOrderId, warehouseId);
  purchasing = purchasing[0];
  let committeesVerify = await model.purchasingCommittee2(db, purchaOrderId);
  committeesVerify = committeesVerify[0];
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;
  let at = await model.at(db)//book_prefix
  at = at[0]
  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)
  let year = moment(new Date).get('year') + 1
  let budget = await model.budgetType(db, purchasing[0].budget_detail_id)
  budget = budget[0]
  let totalprice = 0
  let net = 0
  let vat: any;

  let budgetsave = 0;
  budget.forEach(value => {
    budgetsave += value.amount;
    value.amount = model.comma(value.amount);
    value.order_amt = model.comma(value.order_amt);
  });

  purchasing.forEach(value => {
    value.standard_cost = value.standard_cost < value.unit_price ? value.unit_price : value.standard_cost;
    totalprice = value.sub_total;
    net = value.net_total;
    vat = model.comma(value.vat)
    if (value.qty == null) value.qty = 0;
    value.qty = model.commaQty(value.qty);
    value.qtyPoi = model.commaQty(value.qtyPoi);
    value.total_price = model.comma(value.total_price);
    value.unit_price = model.comma(value.unit_price);
    value.standard_cost = model.comma(value.standard_cost);
    value.total = model.commaQty(value.total);
    let year: number = +moment(value.order_date).get('year') + 543;
    value.order_date = moment(value.order_date).format('D MMMM ') + year;
  })

  pcb.forEach(value => {
    value.incoming_balance = model.comma(value.incoming_balance)
    value.amount = model.comma(value.amount)
    value.balance = model.comma(value.balance)
  })

  let ttotalprice = model.comma(totalprice)
  let net_price = model.comma(net)
  let bahtText = model.bahtText(net)
  let _month: any = moment(new Date()).format('MM');
  let _year: any = moment(new Date()).get('year');
  if (_month >= 10) {
    _year = (_year + 1);
  }

  let sdate = (_year - 1) + '-10-01';
  let ldate = (_year) + '-9-30';
  let sumTotal = await model.getSumTotal(db, purchasing[0].budget_detail_id)
  sumTotal = sumTotal[0];
  let sum = model.comma(budgetsave - sumTotal[0].sum)
  sumTotal = model.comma(sumTotal[0].sum - totalprice)

  let getAmountTransaction = await model.allAmountTransaction(db, purchasing[0].budget_detail_id, _year, purchasing[0].purchase_order_id)
  getAmountTransaction = getAmountTransaction[0];
  let allAmount: any = getAmountTransaction[0].amount;
  allAmount = model.comma(allAmount);

  if (pcb[0] == null
    || type == null
    || purchasing == null
    || sum == null
    || hospitalName == null
    || at[0].value == null
    || nDate == null
    || committeesVerify == null
    || bahtText == null
    || budget == null
    || sumTotal == null
  )
    res.render('error404')
  res.render('purchasing10sd', {
    allAmount: allAmount,
    pcb: pcb[0],
    chief: chief,
    type: type,
    purchasing: purchasing,
    sum: sum,
    vat: vat,
    total: ttotalprice,
    net: net_price,
    hospitalName: hospitalName,
    at_name: at[0].value,
    nDate: nDate,
    committeesVerify: committeesVerify,
    bahtText: bahtText,
    budget: budget,
    poraor: poraor,
    purchasingChief: purchasingChief[0],
    sumTotal: sumTotal,
    cposition: cposition,
    bposition: bposition
  });
}));

router.get('/report/purchasing/11', wrap(async (req, res, next) => {
  let db = req.db;
  let type = req.query.type;
  let bgtypesub = req.query.bgtypesub;
  let bgtype = req.query.bgtype;
  let purchaOrderId = req.query.purchaOrderId;
  let warehouseId = req.decoded.warehouseId;


  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId)
  let hosdetail = await model.hospital(db);
  let province = hosdetail[0].province;
  let address = hosdetail[0].address;
  let tel = hosdetail[0].telephone;
  let fax = hosdetail[0].fax;
  let hospitalName = hosdetail[0].hospname;
  let addressCityHall = hosdetail[0].addressCityHall;
  let poraor = hosdetail[0].managerName;
  let purchasing = await model.purchasing10(db, purchaOrderId, warehouseId);
  purchasing = purchasing[0];

  let cposition
  if (purchasingChief[0].chief_id) {
    cposition = await model.getPosition(db, purchasingChief[0].chief_id);
    cposition = cposition[0]
  } else cposition = '';

  let bposition
  if (purchasingChief[0].buyer_id) {
    bposition = await model.getPosition(db, purchasingChief[0].buyer_id);
    bposition = bposition[0]
  } else bposition = '';

  let committeesVerify = await model.purchasingCommittee2(db, purchaOrderId);
  committeesVerify = committeesVerify[0];
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;
  let at = await model.at(db)//book_prefix
  at = at[0]
  moment.locale('th');
  let nDate = moment(purchasing[0].order_date).format('MMMM ') + (moment(purchasing[0].order_date).get('year') + 543)
  let dDate = moment(purchasing[0].order_date).format(' MMMM ') + (moment(purchasing[0].order_date).get('year') + 543)
  let year = moment(purchasing[0].order_date).get('year') + 544

  let bidname = purchasing[0].name;
  let budget = await model.budgetType(db, purchasing[0].budget_detail_id)
  budget = budget[0]
  let totalprice = 0
  let poNumber = purchasing[0].purchase_order_book_number ? purchasing[0].purchase_order_book_number : '';

  let sum = model.comma(budget[0].amount - budget[0].order_amt)
  budget.forEach(value => {
    value.amount = model.comma(value.amount)
    value.order_amt = model.comma(value.order_amt)
  });
  let countp = 0;
  purchasing.forEach(value => {
    countp++;
    totalprice += value.total_price
    if (value.qty == null) value.qty = 0;
    value.qty = model.commaQty(value.qty);
    value.conversion = model.commaQty(value.conversion);
    value.qtyPoi = model.commaQty(value.qtyPoi);
    value.total_price = model.comma(value.total_price);
    value.cost = model.comma(value.cost);
    value.standard_cost = model.comma(value.standard_cost);
    value.unit_price = model.comma(value.unit_price);
    value.total = model.commaQty(value.total)
  })
  let ttotalprice = model.comma(totalprice)
  let bahtText = model.bahtText(totalprice)

  let pcb = await model.pcBudget(db, purchaOrderId);
  pcb.forEach(value => {
    value.incoming_balance = model.comma(value.incoming_balance)
    value.amount = model.comma(value.amount)
    value.balance = model.comma(value.balance)
  })

  let getAmountTransaction = await model.allAmountTransaction(db, purchasing[0].budget_detail_id, +year - 544, purchasing[0].purchase_order_id);
  getAmountTransaction = getAmountTransaction[0];
  let allAmount: any = getAmountTransaction[0].amount;
  allAmount = model.comma(allAmount);

  res.render('purchasing11', {
    addressCityHall: addressCityHall,
    province: province,
    bidname: bidname,
    tel: tel,
    fax: fax,
    address: address,
    allAmount: allAmount,
    pcb: pcb[0],
    poNumber: poNumber,
    cposition: cposition,
    bposition: bposition,
    type: type,
    purchasing: purchasing,
    sum: sum,
    countp: countp,
    total: ttotalprice,
    hospitalName: hospitalName,
    at_name: at[0].value,
    chief: chief,
    nDate: nDate,
    dDate: dDate,
    committeesVerify: committeesVerify,
    bahtText: bahtText,
    budget: budget,
    poraor: poraor,
    purchasingChief: purchasingChief[0],
  });
}));

router.get('/report/purchasing-standard/11', wrap(async (req, res, next) => {
  let db = req.db;
  let type = req.query.type;
  let bgtypesub = req.query.bgtypesub;
  let bgtype = req.query.bgtype;
  let purchaOrderId = req.query.purchaOrderId;
  let warehouseId = req.decoded.warehouseId;

  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId)
  let hosdetail = await model.hospital(db);
  let province = hosdetail[0].province;
  let address = hosdetail[0].address;
  let tel = hosdetail[0].telephone;
  let fax = hosdetail[0].fax;
  let hospitalName = hosdetail[0].hospname;
  let addressCityHall = hosdetail[0].addressCityHall;
  let poraor = hosdetail[0].managerName;
  let purchasing = await model.purchasing10(db, purchaOrderId, warehouseId);
  purchasing = purchasing[0];

  let cposition
  if (purchasingChief[0].chief_id) {
    cposition = await model.getPosition(db, purchasingChief[0].chief_id);
    cposition = cposition[0]
  } else cposition = '';

  let bposition
  if (purchasingChief[0].buyer_id) {
    bposition = await model.getPosition(db, purchasingChief[0].buyer_id);
    bposition = bposition[0]
  } else bposition = '';

  let committeesVerify = await model.purchasingCommittee2(db, purchaOrderId);
  committeesVerify = committeesVerify[0];
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;
  let at = await model.at(db)//book_prefix
  at = at[0]
  moment.locale('th');
  let nDate = moment(purchasing[0].order_date).format('MMMM ') + (moment(purchasing[0].order_date).get('year') + 543)
  let dDate = moment(purchasing[0].order_date).format(' MMMM ') + (moment(purchasing[0].order_date).get('year') + 543)
  let year = moment(purchasing[0].order_date).get('year') + 544

  let bidname = purchasing[0].name;
  let budget = await model.budgetType(db, purchasing[0].budget_detail_id)
  budget = budget[0]
  let totalprice = 0
  let net = 0
  let vat: any
  let poNumber = purchasing[0].purchase_order_book_number ? purchasing[0].purchase_order_book_number : '';

  let sum = model.comma(budget[0].amount - budget[0].order_amt)
  budget.forEach(value => {
    value.amount = model.comma(value.amount)
    value.order_amt = model.comma(value.order_amt)
  });
  let countp = 0;
  purchasing.forEach(value => {
    countp++;
    vat = value.vat
    totalprice = value.sub_total
    net = value.net_total
    if (value.qty == null) value.qty = 0;
    value.qty = model.commaQty(value.qty);
    value.conversion = model.commaQty(value.conversion);
    value.qtyPoi = model.commaQty(value.qtyPoi);
    value.total_price = model.comma(value.total_price);
    value.cost = model.comma(value.cost);
    value.standard_cost = model.comma(value.standard_cost);
    value.unit_price = model.comma(value.unit_price);
    value.total = model.commaQty(value.total)
  })

  vat = model.comma(vat)
  let ttotalprice = model.comma(totalprice)
  let net_total = model.comma(net)
  let bahtText = model.bahtText(net)

  let pcb = await model.pcBudget(db, purchaOrderId);
  pcb.forEach(value => {
    value.incoming_balance = model.comma(value.incoming_balance)
    value.amount = model.comma(value.amount)
    value.balance = model.comma(value.balance)
  })

  let getAmountTransaction = await model.allAmountTransaction(db, purchasing[0].budget_detail_id, +year - 544, purchasing[0].purchase_order_id);
  getAmountTransaction = getAmountTransaction[0];
  let allAmount: any = getAmountTransaction[0].amount;
  allAmount = model.comma(allAmount);

  res.render('purchasing11standard', {
    addressCityHall: addressCityHall,
    province: province,
    bidname: bidname,
    tel: tel,
    fax: fax,
    vat: vat,
    address: address,
    allAmount: allAmount,
    pcb: pcb[0],
    poNumber: poNumber,
    cposition: cposition,
    bposition: bposition,
    type: type,
    purchasing: purchasing,
    sum: sum,
    countp: countp,
    total: ttotalprice,
    net: net_total,
    hospitalName: hospitalName,
    at_name: at[0].value,
    chief: chief,
    nDate: nDate,
    dDate: dDate,
    committeesVerify: committeesVerify,
    bahtText: bahtText,
    budget: budget,
    poraor: poraor,
    purchasingChief: purchasingChief[0],
  });
}));

router.get('/report/purchasing/12', wrap(async (req, res, next) => {
  let db = req.db;
  let type = req.query.type;
  let bgtype = req.query.bgtype;
  let bgtypesub = req.query.bgtypesub;
  let purchaOrderId = req.query.purchaOrderId;
  let warehouseId = req.decoded.warehouseId;

  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId)

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName
  let purchasing = await model.purchasing10(db, purchaOrderId, warehouseId);
  purchasing = purchasing[0];
  let delivery = purchasing[0].delivery
  let committeesVerify = await model.getCommitteeVerify(db, purchasing[0].verify_committee_id);
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;
  let at = await model.at(db)//book_prefix
  at = at[0]
  moment.locale('th');
  let nDate = moment(new Date()).format('DD MMMM ') + (moment(new Date()).get('year') + 543)
  let year = moment(new Date).get('year') + 544

  let budget = await model.budgetType(db, purchasing[0].budget_detail_id)
  budget = budget[0]
  let totalprice = 0
  let textamount = model.bahtText(budget[0].amount)

  let sum = model.comma(budget[0].amount - budget[0].order_amt)
  budget.forEach(value => {
    value.amount = model.comma(value.amount)
    value.order_amt = model.comma(value.order_amt)
  });
  let bidname = purchasing[0].name

  let countp = 0;
  purchasing.forEach(value => {
    countp++;
    totalprice += value.total_price
    if (value.qty == null) value.qty = 0;
    value.qty = model.commaQty(value.qty);
    value.qtyPoi = model.commaQty(value.qtyPoi);
    value.total_price = model.comma(value.total_price);
    value.unit_price = model.comma(value.unit_price);
    value.total = model.commaQty(value.total)
  })
  let ttotalprice = model.comma(totalprice)
  let bahtText = model.bahtText(totalprice)
  let province = hosdetail[0].province;

  res.render('purchasing12', {
    delivery: delivery,
    textamount: textamount,
    type: type,
    purchasing: purchasing,
    sum: sum,
    province: province,
    countp: countp,
    total: ttotalprice,
    hospitalName: hospitalName,
    at_name: at[0].value,
    nDate: nDate,
    committeesVerify: committeesVerify,
    bidname: bidname,
    // committeesCheck:committeesCheck,
    bahtText: bahtText,
    budget: budget,
    poraor: poraor,
    purchasingChief: purchasingChief[0],
  });
}));

router.get('/report/purchasing/13', wrap(async (req, res, next) => {
  let db = req.db;
  let type = req.query.type;
  let bgtype = req.query.bgtype;
  let bgtypesub = req.query.bgtypesub;
  let purchaOrderId = req.query.purchaOrderId;
  let warehouseId = req.decoded.warehouseId;

  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId)

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName
  let purchasing = await model.purchasing10(db, purchaOrderId, warehouseId);
  purchasing = purchasing[0];
  let committeesVerify = await model.getCommitteeVerify(db, purchasing[0].verify_committee_id);
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;
  let at = await model.at(db)//book_prefix
  at = at[0]
  moment.locale('th');
  let nDate = moment(new Date()).format('DD MMMM ') + (moment(new Date()).get('year') + 543)
  let year = moment(new Date).get('year') + 544

  let budget = await model.budgetType(db, purchasing[0].budget_detail_id)
  budget = budget[0]
  let totalprice = 0
  let textamount = model.bahtText(budget[0].amount)

  let sum = model.comma(budget[0].amount - budget[0].order_amt)
  budget.forEach(value => {
    value.amount = model.comma(value.amount)
    value.order_amt = model.comma(value.order_amt)
  });
  let bidname = purchasing[0].name

  let countp = 0;
  purchasing.forEach(value => {
    countp++;
    totalprice += value.total_price
    if (value.qty == null) value.qty = 0;
    value.qty = model.commaQty(value.qty);
    value.qtyPoi = model.commaQty(value.qtyPoi);
    value.total_price = model.comma(value.total_price);
    value.unit_price = model.comma(value.unit_price);
    value.total = model.commaQty(value.total)
  })
  let ttotalprice = model.comma(totalprice)
  let bahtText = model.bahtText(totalprice)
  let province = hosdetail[0].province;

  res.render('purchasing13', {
    textamount: textamount,
    type: type,
    purchasing: purchasing,
    sum: sum,
    province: province,
    countp: countp,
    total: ttotalprice,
    hospitalName: hospitalName,
    at_name: at[0].value,
    nDate: nDate,
    committeesVerify: committeesVerify,
    bidname: bidname,
    bahtText: bahtText,
    budget: budget,
    poraor: poraor,
    purchasingChief: purchasingChief[0],
  });
}));

router.get('/report/purchasing/14', wrap(async (req, res, next) => {
  let db = req.db;
  let type = req.query.type;
  let bgtype = req.query.bgtype;
  let bgtypesub = req.query.bgtypesub;
  let purchaOrderId = req.query.purchaOrderId;
  let warehouseId = req.decoded.warehouseId;

  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId)

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName
  let purchasing = await model.purchasing10(db, purchaOrderId, warehouseId);
  purchasing = purchasing[0];
  let committeesVerify = await model.getCommitteeVerify(db, purchasing[0].verify_committee_id);
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;
  let at = await model.at(db)//book_prefix
  at = at[0]
  moment.locale('th');
  let nDate = moment(new Date()).format('DD MMMM ') + (moment(new Date()).get('year') + 543)
  let year = moment(new Date).get('year') + 544

  let budget = await model.budgetType(db, purchasing[0].budget_detail_id)
  budget = budget[0]
  let totalprice = 0
  let textamount = model.bahtText(budget[0].amount)

  let sum = model.comma(budget[0].amount - budget[0].order_amt)
  budget.forEach(value => {
    value.amount = model.comma(value.amount)
    value.order_amt = model.comma(value.order_amt)
  });
  let bidname = purchasing[0].name

  let countp = 0;
  purchasing.forEach(value => {
    countp++;
    totalprice += value.total_price
    if (value.qty == null) value.qty = 0;
    value.qty = model.commaQty(value.qty);
    value.qtyPoi = model.commaQty(value.qtyPoi);
    value.total_price = model.comma(value.total_price);
    value.unit_price = model.comma(value.unit_price);
    value.total = model.commaQty(value.total)
  })
  let ttotalprice = model.comma(totalprice)
  let bahtText = model.bahtText(totalprice)
  let province = hosdetail[0].province;

  res.render('purchasing14', {
    textamount: textamount,
    type: type,
    purchasing: purchasing,
    sum: sum,
    province: province,
    countp: countp,
    total: ttotalprice,
    hospitalName: hospitalName,
    at_name: at[0].value,
    nDate: nDate,
    committeesVerify: committeesVerify,
    bidname: bidname,
    // committeesCheck:committeesCheck,
    bahtText: bahtText,
    budget: budget,
    poraor: poraor,
    purchasingChief: purchasingChief[0],
  });
}));

router.get('/report/purchasing/15', wrap(async (req, res, next) => {
  let db = req.db;
  let type = req.query.type;
  let bgtype = req.query.bgtype;
  let bgtypesub = req.query.bgtypesub;
  let purchaOrderId = req.query.purchaOrderId;
  let warehouseId = req.decoded.warehouseId;

  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId)

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName
  let purchasing = await model.purchasing10(db, purchaOrderId, warehouseId);
  purchasing = purchasing[0];
  let committeesVerify = await model.getCommitteeVerify(db, purchasing[0].verify_committee_id);
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;
  let at = await model.at(db)//book_prefix
  at = at[0]
  moment.locale('th');
  let nDate = moment(new Date()).format('DD MMMM ') + (moment(new Date()).get('year') + 543)
  let year = moment(new Date).get('year') + 544

  let budget = await model.budgetType(db, purchasing[0].budget_detail_id)
  budget = budget[0]
  let totalprice = 0
  let textamount = model.bahtText(budget[0].amount)

  let sum = model.comma(budget[0].amount - budget[0].order_amt)
  budget.forEach(value => {
    value.amount = model.comma(value.amount)
    value.order_amt = model.comma(value.order_amt)
  });
  let bidname = purchasing[0].name

  let countp = 0;
  purchasing.forEach(value => {
    countp++;
    totalprice += value.total_price
    if (value.qty == null) value.qty = 0;
    value.qty = model.commaQty(value.qty);
    value.qtyPoi = model.commaQty(value.qtyPoi);
    value.total_price = model.comma(value.total_price);
    value.unit_price = model.comma(value.unit_price);
    value.total = model.commaQty(value.total)
  })
  let ttotalprice = model.comma(totalprice)
  let bahtText = model.bahtText(totalprice)
  let province = hosdetail[0].province;
  let lname = purchasing[0].labeler_name

  res.render('purchasing15', {
    lname: lname,
    textamount: textamount,
    type: type,
    purchasing: purchasing,
    sum: sum,
    province: province,
    countp: countp,
    total: ttotalprice,
    hospitalName: hospitalName,
    at_name: at[0].value,
    nDate: nDate,
    committeesVerify: committeesVerify,
    bidname: bidname,
    // committeesCheck:committeesCheck,
    bahtText: bahtText,
    budget: budget,
    poraor: poraor,
    purchasingChief: purchasingChief[0],
  });
}));

router.get('/report/purchasing/16', wrap(async (req, res, next) => {
  let db = req.db;
  let purchaOrderId = req.query.purchaOrderId;
  let warehouseId = req.decoded.warehouseId;

  let purchasingOfficer = await model.getPurchasingOfficer(db);
  let purchasingChief = await model.purchasing2Chief(db, purchaOrderId)

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName
  let purchasing = await model.purchasing10(db, purchaOrderId, warehouseId);
  purchasing = purchasing[0];
  let committeesVerify = await model.getCommitteeVerify(db, purchasing[0].verify_committee_id);
  let count = await model.purchasingCountItem(db, purchaOrderId);
  count = count[0][0].count || 0;
  let at = await model.at(db)//book_prefix
  at = at[0]
  moment.locale('th');
  let nDate = moment(new Date()).format('DD MMMM ') + (moment(new Date()).get('year') + 543)
  let orderDate = moment(purchasing[0].order_date).format('DD MMMM ') + (moment(purchasing[0].order_date).get('year') + 543)
  let year = moment(new Date).get('year') + 544
  let bgtypesub = req.query.bgtypesub;
  let budget = await model.budgetType(db, purchasing[0].budget_detail_id)
  budget = budget[0]
  let totalprice = 0
  let textamount = model.bahtText(budget[0].amount)

  let limitDate = moment().add(purchasing[0].delivery, 'days').format('D MMMM ') + (moment(purchasing[0].order_date).get('year') + 543);

  let sum = model.comma(budget[0].amount - budget[0].order_amt)
  budget.forEach(value => {
    value.amount = model.comma(value.amount)
    value.order_amt = model.comma(value.order_amt)
  });
  let bidname = purchasing[0].name

  let countp = 0;
  purchasing.forEach(value => {
    countp++;
    totalprice += value.total_price
    if (value.qty == null) value.qty = 0;
    value.qty = model.commaQty(value.qty);
    value.qtyPoi = model.commaQty(value.qtyPoi);
    value.total_price = model.comma(value.total_price);
    value.unit_price = model.comma(value.unit_price);
    value.total = model.commaQty(value.total)
  })
  let ttotalprice = model.comma(totalprice)
  let bahtText = model.bahtText(totalprice)
  let province = hosdetail[0].province;
  let lname = purchasing[0].labeler_name

  res.render('purchasing16single', {
    limitDate: limitDate,
    order_date: orderDate,
    lname: lname,
    textamount: textamount,
    purchasing: purchasing,
    sum: sum,
    province: province,
    countp: countp,
    total: ttotalprice,
    hospitalName: hospitalName,
    at_name: at[0].value,
    nDate: nDate,
    committeesVerify: committeesVerify,
    bidname: bidname,
    bahtText: bahtText,
    budget: budget,
    poraor: poraor,
    purchasingChief: purchasingChief[0],
  });
}));

router.post('/report/purchasingorder', wrap(async (req, res, next) => {
  let purchasOrderId = req.body.orderId;

  let num = purchasOrderId.length;
  let db = req.db;
  let hospname = await model.hospital(db)
  let hospAddress = hospname[0].address
  let hopsTel = hospname[0].telephone
  let hopsprovince = hospname[0].province
  hospname = hospname[0].hospname

  let nDate = moment(new Date()).format('DD MMMM ') + (moment(new Date()).get('year') + 543)
  let array = [];
  let array1 = [];
  let arrayDate = [];
  for (let i = 0; i < num; i++) {
    let results = await model.purchasingOrder(db, purchasOrderId[i])
    results = results[0];
    let order_date = moment(results.order_date).format('DD MMMM ') + (moment(results.order_date).get('year') + 543)
    arrayDate.push(order_date);
    array.push(results);

    let getchief = await model.purchasing2Chief(db, purchasOrderId[i]);
    getchief = getchief[0].chief_fullname;
    array1.push(getchief);
    console.log(getchief);

  }
  res.render('porders', {
    arrayDate: arrayDate,
    array: array,
    num: num,
    hospname: hospname,
    getchief: array1,
    nDate: nDate,
    hospAddress: hospAddress,
    hopsTel: hopsTel,
    hopsprovince: hopsprovince
  });
}));

router.get('/report/getporder', wrap(async (req, res, next) => {
  let porder = req.query.porder
  let db = req.db;

  let hospname = await model.hospital(db)
  let hospAddress = hospname[0].address
  let hopsTel = hospname[0].telephone
  let hopsprovince = hospname[0].province
  hospname = hospname[0].hospname
  moment.locale('th');
  let nDate = moment(new Date()).format('DD MMMM ') + (moment(new Date()).get('year') + 543)
  let array = [];
  let array1 = [];
  let arraySum = [];
  let arraySumText = [];

  for (let i = 0; i < porder.length; i++) {
    let sum: any = 0;
    let sumtext: any = ""
    let results = await model.purchasingOrder(db, porder[i])
    results = results[0];
    array.push(results);
    results.forEach(value => {
      sum += value.total;
      value.total = model.comma(value.total)
    });
    sumtext = model.bahtText(sum)
    sum = model.comma(sum);
    arraySum.push(sum)
    arraySumText.push(sumtext)

    let getchief = await model.purchasing2Chief(db, porder[i]);
    getchief = getchief[0].chief_fullname;
    array1.push(getchief);
  }
  res.render('porders', {
    arraySum: arraySum,
    arraySumText: arraySumText,
    array: array,
    num: porder.length,
    hospname: hospname,
    getchief: array1,
    nDate: nDate,
    hospAddress: hospAddress,
    hopsTel: hopsTel,
    hopsprovince: hopsprovince
  })
}));

router.get('/report/getporder/singburi', wrap(async (req, res, next) => {
  let _porder = req.query.porder;
  let db = req.db;

  let hospname = await model.hospital(db)
  let hospAddress = hospname[0].address
  let hopsTel = hospname[0].telephone
  let hopsprovince = hospname[0].province
  hospname = hospname[0].hospname
  moment.locale('th');
  let nDate = moment(new Date()).format('DD MMMM ') + (moment(new Date()).get('year') + 543)
  let array = [];
  let array1 = [];
  let arraySum = [];
  let arraySumText = [];
  let poraor = hospname[0].managerName
  let chief: any = []

  let porder = [];

  if (typeof _porder === 'string') {
    porder.push(_porder);
  } else {
    porder = _porder;
  }

  for (let i = 0; i < porder.length; i++) {
    let sum: any = 0;
    let sumtext: any = ""
    let results = await model.purchasingOrder(db, porder[i])
    results = results[0];
    array.push(results);
    results.forEach(value => {
      sum += value.total;
      value.total = model.comma(value.total);
      value.unit = model.comma(value.unit);
      value.small_qty = model.commaQty(value.small_qty);
      value.qty = model.commaQty(value.qty);
    });

    sumtext = model.bahtText(sum)
    sum = model.comma(sum);
    arraySum.push(sum)
    arraySumText.push(sumtext)

    let getchief = await model.purchasing2Chief(db, porder[i]);
    getchief = getchief[0].chief_fullname;
    array1.push(getchief);
  }

  res.render('purchase_order', {
    chief: chief,
    arraySum: arraySum,
    arraySumText: arraySumText,
    array: array,
    num: porder.length,
    hospname: hospname,
    getchief: array1,
    nDate: nDate,
    hospAddress: hospAddress,
    hopsTel: hopsTel,
    hopsprovince: hopsprovince
  })
}));

router.get('/report/allpo/egp/singburi', wrap(async (req, res, next) => {
  let porder = req.query.porder;

  porder = Array.isArray(porder) ? porder : [porder];

  let warehouseId = req.decoded.warehouseId;
  let type = req.query.type;
  let db = req.db;

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName;
  let hosaddress = hosdetail[0].address;
  let hostel = hosdetail[0].telephone;
  let province = hosdetail[0].province;

  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)

  let pcb;

  let committeesVerify;
  let arrayItems;
  let bidname;
  let bahtText: any = 0;
  let purchasingChief;
  let budget;

  let arBudget = [];
  let arrayChief = [];
  let arrayTotal = [];
  let arrayBahtText = [];
  let arrayBid = [];
  let purchasing = [];
  let arPcb = [];

  let arCommittee = [];
  let arAllamount = [];
  let arAtransection = [];

  let getAmountTransaction;
  let allAmount;

  for (let i in porder) {
    arrayItems = await model.purchasingEgp(db, porder[i], warehouseId);
    purchasing.push(arrayItems);

    purchasingChief = await model.purchasing2Chief(db, porder[i]);
    arrayChief.push(purchasingChief);

    committeesVerify = await model.purchasingCommittee2(db, porder[i]);
    committeesVerify = committeesVerify[0];
    arCommittee.push(committeesVerify);

    budget = await model.budgetType(db, purchasing[i][0].budget_detail_id);
    budget = budget[0];
    arBudget.push(budget);
    arBudget[i][0].amount = model.comma(arBudget[i][0].amount);

    getAmountTransaction = await model.allAmountTransaction(db, purchasing[i][0].budget_detail_id, +arBudget[i][0].bg_year - 543, purchasing[i][0].purchase_order_id);
    getAmountTransaction = getAmountTransaction[0];
    arAtransection.push(getAmountTransaction);

    pcb = await model.pcBudget(db, porder[i]);
    arPcb.push(pcb);
    if (arPcb[i].length) {
      arPcb[i][0].balance = model.comma(arPcb[i][0].balance);
    }

    allAmount = model.comma(arAtransection[i][0].amount);
    arAllamount.push(allAmount);

    let total: any = 0;
    arrayItems.forEach(v => {
      v.order_date = moment(v.order_date).format('D MMMM ') + (moment(v.order_date).get('year') + 543);
      total += v.total_price;
      v.total_price = model.comma(v.total_price);
      v.qty = model.commaQty(v.qty);
      v.unit_price = model.comma(v.unit_price);
      v.qtyPoi = model.commaQty(v.qtyPoi);
      v.standard_cost = model.comma(v.standard_cost);
      v.cost = model.comma(v.cost);
    });

    bahtText = model.bahtText(total);
    total = model.comma(total);
    arrayTotal.push(total);
    arrayBahtText.push(bahtText);

    bidname = await model.bidName(db, purchasing[i][0].purchase_method_id);
    arrayBid.push(bidname);
  }

  res.render('egpSingburi', {
    hosaddress: hosaddress,
    arAllamount: arAllamount,
    arPcb: arPcb,
    hostel: hostel,
    arBudget: arBudget,
    arCommittee: arCommittee,
    province: province,
    chief: chief,
    poraor: poraor,
    arrayChief: arrayChief,
    arrayBahtText: arrayBahtText,
    arrayTotal: arrayTotal,
    nDate: nDate,
    arrayBid: arrayBid,
    purchasing: purchasing,
    porder: porder,
    hospitalName: hospitalName,
    pcb: pcb
  });
}));

router.get('/report/allpo/egp/', wrap(async (req, res, next) => {
  let porder = req.query.porder;
  porder = Array.isArray(porder) ? porder : [porder];

  let warehouseId = req.decoded.warehouseId;
  let type = req.query.type;
  let db = req.db;

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName;
  let hosaddress = hosdetail[0].address;
  let hostel = hosdetail[0].telephone;
  let province = hosdetail[0].province;

  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)

  let pcb;

  let committeesVerify;
  let arrayItems;
  let bidname;
  let bahtText: any = 0;
  let purchasingChief;
  let budget;

  let arBudget = [];
  let arrayChief = [];
  let arrayTotal = [];
  let arrayBahtText = [];
  let arrayBid = [];
  let purchasing = [];
  let arPcb = [];

  let arrayVat = [];
  let arrayNet = [];

  let arCommittee = [];
  let arAllamount = [];
  let arAtransection = [];

  let getAmountTransaction;
  let allAmount;
  let limitDate: any = [];

  let standardCost = [];
  let standardCostText = [];
  for (let i in porder) {
    arrayItems = await model.purchasingEgp(db, porder[i], warehouseId);
    purchasing.push(arrayItems);

    purchasingChief = await model.purchasing2Chief(db, porder[i]);
    arrayChief.push(purchasingChief);

    committeesVerify = await model.purchasingCommittee2(db, porder[i]);
    committeesVerify = committeesVerify[0];
    arCommittee.push(committeesVerify);

    budget = await model.budgetType(db, purchasing[i][0].budget_detail_id);
    budget = budget[0];
    arBudget.push(budget);
    arBudget[i][0].amount = model.comma(arBudget[i][0].amount);

    getAmountTransaction = await model.allAmountTransaction(db, purchasing[i][0].budget_detail_id, +arBudget[i][0].bg_year - 543, purchasing[i][0].purchase_order_id);
    getAmountTransaction = getAmountTransaction[0];
    arAtransection.push(getAmountTransaction);

    pcb = await model.pcBudget(db, porder[i]);
    arPcb.push(pcb);
    if (arPcb[i].length) {
      arPcb[i][0].balance = model.comma(arPcb[i][0].balance);
    }

    allAmount = model.comma(arAtransection[i][0].amount);
    arAllamount.push(allAmount);
    limitDate.push(moment().add(purchasing[i][0].delivery, 'days').format('D MMMM ') + (moment(purchasing[i][0].order_date).get('year') + 543));

    let total: any = 0;
    arrayItems.forEach(v => {
      v.order_date = moment(v.order_date).format('D MMMM ') + (moment(v.order_date).get('year') + 543);
      if (v.giveaway == 'Y') {
        v.sumcost = model.comma(0.00)
      } else {
        v.sumcost = model.comma(v.qtyPoi * v.unit_price)
      }
      total = v.sub_total;
      v.total_price = model.comma(v.total_price);
      v.qty = model.commaQty(v.qty);
      v.unit_price = model.comma(v.unit_price);
      v.qtyPoi = model.commaQty(v.qtyPoi);
      v.standard_cost = model.comma(v.standard_cost);
      v.cost = model.comma(v.cost);
    });

    let net = purchasing[i][0].vat + total;
    bahtText = model.bahtText(net);
    net = model.comma(net);

    arrayNet.push(net);

    purchasing[i][0].vat = model.comma(purchasing[i][0].vat);
    arrayVat.push(purchasing[i][0].vat);

    total = model.comma(total);
    arrayTotal.push(total);
    arrayBahtText.push(bahtText);

    bidname = await model.bidName(db, purchasing[i][0].purchase_method_id);
    arrayBid.push(bidname);
  }

  res.render('egp', {
    arrayNet: arrayNet,
    arrayVat: arrayVat,
    limitDate: limitDate,
    hosaddress: hosaddress,
    arAllamount: arAllamount,
    arPcb: arPcb,
    hostel: hostel,
    arBudget: arBudget,
    arCommittee: arCommittee,
    province: province,
    chief: chief,
    poraor: poraor,
    arrayChief: arrayChief,
    arrayBahtText: arrayBahtText,
    arrayTotal: arrayTotal,
    nDate: nDate,
    arrayBid: arrayBid,
    purchasing: purchasing,
    porder: porder,
    hospitalName: hospitalName,
    pcb: pcb
  });
}));

router.get('/report/getporder/standard/', wrap(async (req, res, next) => {
  let porder = req.query.porder;
  porder = Array.isArray(porder) ? porder : [porder];

  let warehouseId = req.decoded.warehouseId;
  let type = req.query.type;
  let db = req.db;

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName;
  let hosaddress = hosdetail[0].address;
  let hostel = hosdetail[0].telephone;
  let province = hosdetail[0].province;

  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)

  let pcb;

  let committeesVerify;
  let arrayItems;
  let bidname;
  let bahtText: any = 0;
  let purchasingChief;
  let budget;

  let arBudget = [];
  let arrayChief = [];
  let arrayTotal = [];
  let arrayBahtText = [];
  let arrayBid = [];
  let purchasing = [];
  let arPcb = [];

  let arrayVat = [];
  let arrayNet = [];

  let arCommittee = [];
  let arAllamount = [];
  let arAtransection = [];

  let getAmountTransaction;
  let allAmount;
  let limitDate: any = [];

  for (let i in porder) {
    arrayItems = await model.purchasingEgp(db, porder[i], warehouseId);
    purchasing.push(arrayItems);

    purchasingChief = await model.purchasing2Chief(db, porder[i]);
    arrayChief.push(purchasingChief);

    committeesVerify = await model.purchasingCommittee2(db, porder[i]);
    committeesVerify = committeesVerify[0];
    arCommittee.push(committeesVerify);

    budget = await model.budgetType(db, purchasing[i][0].budget_detail_id);
    budget = budget[0];
    arBudget.push(budget);
    arBudget[i][0].amount = model.comma(arBudget[i][0].amount);

    getAmountTransaction = await model.allAmountTransaction(db, purchasing[i][0].budget_detail_id, +arBudget[i][0].bg_year - 543, purchasing[i][0].purchase_order_id);
    getAmountTransaction = getAmountTransaction[0];
    arAtransection.push(getAmountTransaction);

    pcb = await model.pcBudget(db, porder[i]);
    arPcb.push(pcb);
    if (arPcb[i].length) {
      arPcb[i][0].balance = model.comma(arPcb[i][0].balance);
    }
    allAmount = model.comma(arAtransection[i][0].amount);
    arAllamount.push(allAmount);
    limitDate.push(moment().add(purchasing[i][0].delivery, 'days').format('D MMMM ') + (moment(purchasing[i][0].order_date).get('year') + 543));

    let total: any = 0;
    arrayItems.forEach(v => {
      v.order_date = moment(v.order_date).format('D MMMM ') + (moment(v.order_date).get('year') + 543);
      if (v.giveaway == 'Y') {
        v.sumcost = model.comma(0.00)
      } else {
        v.sumcost = model.comma(v.qtyPoi * v.unit_price)
      }
      total = v.sub_total;
      v.total_price = model.comma(v.total_price);
      v.qty = model.commaQty(v.qty);
      v.unit_price = model.comma(v.unit_price);
      v.qtyPoi = model.commaQty(v.qtyPoi);
      v.standard_cost = model.comma(v.standard_cost);
      v.cost = model.comma(v.cost);
    });

    let net = purchasing[i][0].vat + total;
    bahtText = model.bahtText(net);
    net = model.comma(net);

    arrayNet.push(net);

    purchasing[i][0].vat = model.comma(purchasing[i][0].vat);
    arrayVat.push(purchasing[i][0].vat);

    total = model.comma(total);
    arrayTotal.push(total);
    arrayBahtText.push(bahtText);

    bidname = await model.bidName(db, purchasing[i][0].purchase_method_id);
    arrayBid.push(bidname);
  }

  res.render('purchasing16', {
    arrayNet: arrayNet,
    arrayVat: arrayVat,
    limitDate: limitDate,
    hosaddress: hosaddress,
    arAllamount: arAllamount,
    arPcb: arPcb,
    hostel: hostel,
    arBudget: arBudget,
    arCommittee: arCommittee,
    province: province,
    chief: chief,
    poraor: poraor,
    arrayChief: arrayChief,
    arrayBahtText: arrayBahtText,
    arrayTotal: arrayTotal,
    nDate: nDate,
    arrayBid: arrayBid,
    purchasing: purchasing,
    porder: porder,
    hospitalName: hospitalName,
    pcb: pcb
  });
}));

router.get('/report/getProductHistory/:generic_code', wrap(async (req, res, next) => {
  let db = req.db;
  let generic_code = req.params.generic_code;
  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let hostel = hosdetail[0].telephone;
  let hosaddress = hosdetail[0].address;

  let rs: any = await model.getProductHistory(db, generic_code);

  res.render('purchaseHistory', {
    hospitalName: hospitalName
  });
}));

router.get('/report/getporder/DebaratanaNakhonratchasima/', wrap(async (req, res, next) => {
  let porder = req.query.porder;
  porder = Array.isArray(porder) ? porder : [porder];

  let warehouseId = req.decoded.warehouseId;
  let type = req.query.type;
  let db = req.db;

  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let poraor = hosdetail[0].managerName;
  let hosaddress = hosdetail[0].address;
  let hostel = hosdetail[0].telephone;
  let province = hosdetail[0].province;

  moment.locale('th');
  let nDate = moment(new Date()).format('D MMMM ') + (moment(new Date()).get('year') + 543)

  let pcb;

  let committeesVerify;
  let arrayItems;
  let bidname;
  let bahtText: any = 0;
  let purchasingChief;
  let budget;

  let arBudget = [];
  let arrayChief = [];
  let arrayTotal = [];
  let arrayBahtText = [];
  let arrayBid = [];
  let purchasing = [];
  let arPcb = [];

  let arrayVat = [];
  let arrayNet = [];

  let arCommittee = [];
  let arAllamount = [];
  let arAtransection = [];

  let getAmountTransaction;
  let allAmount;
  let limitDate: any = [];

  for (let i in porder) {
    arrayItems = await model.purchasingEgp(db, porder[i], warehouseId);
    purchasing.push(arrayItems);

    purchasingChief = await model.purchasing2Chief(db, porder[i]);
    arrayChief.push(purchasingChief);

    committeesVerify = await model.purchasingCommittee2(db, porder[i]);
    committeesVerify = committeesVerify[0];
    arCommittee.push(committeesVerify);

    budget = await model.budgetType(db, purchasing[i][0].budget_detail_id);
    budget = budget[0];
    arBudget.push(budget);
    arBudget[i][0].amount = model.comma(arBudget[i][0].amount);

    getAmountTransaction = await model.allAmountTransaction(db, purchasing[i][0].budget_detail_id, +arBudget[i][0].bg_year - 543, purchasing[i][0].purchase_order_id);
    getAmountTransaction = getAmountTransaction[0];
    arAtransection.push(getAmountTransaction);

    pcb = await model.pcBudget(db, porder[i]);
    arPcb.push(pcb);
    if (arPcb[i].length) {
      arPcb[i][0].balance = model.comma(arPcb[i][0].balance);
    }
    allAmount = model.comma(arAtransection[i][0].amount);
    arAllamount.push(allAmount);
    limitDate.push(moment().add(purchasing[i][0].delivery, 'days').format('D MMMM ') + (moment(purchasing[i][0].order_date).get('year') + 543));

    let total: any = 0;
    arrayItems.forEach(v => {
      v.order_date = moment(v.order_date).format('D MMMM ') + (moment(v.order_date).get('year') + 543);
      if (v.giveaway == 'Y') {
        v.sumcost = model.comma(0.00)
      } else {
        v.sumcost = model.comma(v.qtyPoi * v.unit_price)
      }
      if (v.standard_cost <= v.unit_price) {
        v.standard_cost = v.unit_price
      }
      total = v.sub_total;
      v.total_price = model.comma(v.total_price);
      v.qty = model.commaQty(v.qty);
      v.unit_price = model.comma(v.unit_price);
      v.qtyPoi = model.commaQty(v.qtyPoi);
      v.standard_cost = model.comma(v.standard_cost);
      v.cost = model.comma(v.cost);
    });

    //เช็ค net ระหว่าง ถอด vat กับ เพิ่ม vat
    let net: any;
    net = purchasing[i][0].vat + total;
    bahtText = model.bahtText(net);
    net = model.comma(net);
    arrayNet.push(net);


    purchasing[i][0].vat = model.comma(purchasing[i][0].vat);
    arrayVat.push(purchasing[i][0].vat);

    total = model.comma(total);
    arrayTotal.push(total);
    arrayBahtText.push(bahtText);

    bidname = await model.bidName(db, purchasing[i][0].purchase_method_id);
    arrayBid.push(bidname);
  }
  console.log(',,,,,,,,,,,,,,,,,,', arrayItems);

  res.render('purchasing16DebaratanaNakhonratchasima', {
    arrayNet: arrayNet,
    arrayVat: arrayVat,
    limitDate: limitDate,
    hosaddress: hosaddress,
    arAllamount: arAllamount,
    arPcb: arPcb,
    hostel: hostel,
    arBudget: arBudget,
    arCommittee: arCommittee,
    province: province,
    chief: chief,
    poraor: poraor,
    arrayChief: arrayChief,
    arrayBahtText: arrayBahtText,
    arrayTotal: arrayTotal,
    nDate: nDate,
    arrayBid: arrayBid,
    purchasing: purchasing,
    porder: porder,
    hospitalName: hospitalName,
    pcb: pcb
  });
}));

router.get('/report/purchasing-list/excel', async (req, res, next) => {
  let startdate = req.query.startDate;
  let enddate = req.query.endDate;
  let generic_type_id = req.query.genericTypeId;
  let db = req.db;
  let results = await model.PurchasingList(db, startdate, enddate, generic_type_id);
  let hospname = await model.hospital(db);
  if (!results[0].length) { res.render('error404') };
  results = results[0]
  hospname = hospname[0].hospname
  moment.locale('th');
  let sum: any = 0;
  startdate = moment(startdate).format('DD-MM-') + (moment(startdate).get('year') + 543)
  enddate = moment(enddate).format('DD-MM-') + (moment(enddate).get('year') + 543)

  results.forEach(value => {
    sum += value.total_price;
    value.order_date = moment(value.order_date).isValid() ? moment(value.order_date).format('DD/MM/') + (moment(value.order_date).get('year') + 543) : '-';
    value.delivery_date = moment(value.delivery_date).isValid() ? moment(value.delivery_date).format('DD/MM/') + (moment(value.delivery_date).get('year') + 543) : '-';
    value.unit_price = model.comma(value.unit_price)
    value.conversion = model.commaQty(value.conversion)
    value.qty = model.commaQty(value.qty)
    value.total_price = model.comma(value.total_price)
  });
  sum = model.comma(sum)
  let json = [];

  results.forEach(v => {
    let obj: any = {};
    obj.purchase_order_number = v.purchase_order_number;
    obj.purchase_order_book_number = v.purchase_order_book_number;
    obj.order_date = v.order_date;
    obj.product_name = v.product_name;
    obj.qty = v.qty;
    obj.primary_unit = v.primary_unit;
    obj.conversion = v.conversion;
    obj.total_price = v.total_price;
    obj.labeler_name_po = v.labeler_name_po;
    obj.delivery_date = v.delivery_date;
    obj.delivery_code = v.delivery_code;
    obj.sum = ''
    json.push(obj);
  });

  json[json.length - 1].sum = sum

  const xls = json2xls(json);
  const exportDirectory = path.join(process.env.MMIS_DATA, 'exports');
  // create directory
  fse.ensureDirSync(exportDirectory);
  const filePath = path.join(exportDirectory, 'รายงานสรุปรายการเวชภัณฑ์ที่สั่งซื้อ ตั้งแต่ ' + startdate + ' ถึง ' + enddate + '.xlsx');
  fs.writeFileSync(filePath, xls, 'binary');
  // force download
  res.download(filePath, 'รายงานสรุปรายการเวชภัณฑ์ที่สั่งซื้อ ตั้งแต่ ' + startdate + ' ถึง ' + enddate + '.xlsx');
});

router.get('/report/budget-history', wrap(async (req, res, next) => {
  let db = req.db;
  let startDate = req.query.startDate;
  let endDate = req.query.endDate;
  let budgetDetailId = req.query.budgetDetailId;
  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let hostel = hosdetail[0].telephone;
  let hosaddress = hosdetail[0].address;
  moment.locale('th');
  let sdate = moment(startDate).format('D MMMM ') + (moment(startDate).get('year') + 543);
  let edate = moment(endDate).format('D MMMM ') + (moment(endDate).get('year') + 543);

  let results: any = await model.getHudgetHistory(db, startDate, endDate, budgetDetailId);
  results = results[0];

  if (results.length == 0) {
    res.render('error404')
  }

  results.forEach(value => {
    value.date_time = moment(value.date_time).isValid() ? moment(value.date_time).format('DD/MM/') + (moment(value.date_time).get('year') + 543) : '-';
    value.incoming_balance = model.comma(value.incoming_balance)
    if (value.amount < 0) {
      value.amount = value.amount * -1
    }
    value.amount = model.comma(value.amount)
    value.balance = model.comma(value.balance)
  });

  res.render('budgetHistory', {
    hospitalName: hospitalName,
    results: results,
    sdate: sdate,
    edate: edate
  });
}));

router.get('/report/budget-history/excel', wrap(async (req, res, next) => {
  let db = req.db;
  let startDate = req.query.startDate;
  let endDate = req.query.endDate;
  let budgetDetailId = req.query.budgetDetailId;
  let hosdetail = await model.hospital(db);
  let hospitalName = hosdetail[0].hospname;
  let hostel = hosdetail[0].telephone;
  let hosaddress = hosdetail[0].address;
  moment.locale('th');
  let sdate = moment(startDate).format('D MMMM ') + (moment(startDate).get('year') + 543);
  let edate = moment(endDate).format('D MMMM ') + (moment(endDate).get('year') + 543);
  let json = [];

  let results: any = await model.getHudgetHistory(db, startDate, endDate, budgetDetailId);
  results = results[0];

  if (results.length == 0) {
    res.render('error404')
  }

  results.forEach(value => {
    value.date_time = moment(value.date_time).isValid() ? moment(value.date_time).format('DD/MM/') + (moment(value.date_time).get('year') + 543) : '-';
    value.incoming_balance = model.comma(value.incoming_balance)
    if (value.amount < 0) {
      value.amount = value.amount * -1
    }
    value.amount = model.comma(value.amount)
    value.balance = model.comma(value.balance)
  });

  results.forEach(v => {
    let obj: any = {};
    obj.date = v.date_time;
    obj.purchase_order_number = v.purchase_order_book_number || v.purchase_order_number
    obj.incoming_balance = v.incoming_balance
    obj.amount = v.amount
    obj.balance = v.balance
    if (obj.amount >= 0) {
      obj.status = 'ตัดงบ'
    } else {
      obj.status = 'คืนงบ'
    }
    json.push(obj);
  });

  const xls = json2xls(json);
  const exportDirectory = path.join(process.env.MMIS_DATA, 'exports');
  // create directory
  fse.ensureDirSync(exportDirectory);
  const filePath = path.join(exportDirectory, 'รายงานประวัติการใช้งบประมาณ ตั้งแต่ ' + sdate + ' ถึง ' + edate + '.xlsx');
  fs.writeFileSync(filePath, xls, 'binary');
  // force download
  res.download(filePath, 'รายงานประวัติการใช้งบประมาณตั้งแต่ ตั้งแต่ ' + sdate + ' ถึง ' + edate + '.xlsx');
}));

export default router;