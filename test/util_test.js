const assert = require('assert');
const sql = require('mssql/msnodesqlv8');
const loincUtil = require('../src/util');
const config = require('../src/config');

describe('util.js', async function() {
  let pool, sqlUtil;
  let testTable = 'TEST_TABLE';

  before(async function() {
    pool = await sql.connect({options: {trustedConnection: true}, server: config.sqlServerHost});
    sqlUtil = await loincUtil.sqlUtil();
  });

  /**
   *  Inserts values into table testTable.  It is assumed that the values
   *  in rowVals have appropriate datatypes for the table's columns.
   */
  async function insertVals(rowVals) {
    let sql = "INSERT INTO "+testTable+" VALUES ('";
    sql += rowVals.join("', '") + "')";
    await pool.request().query(sql);
  }

  beforeEach(async function() {
    // Create a test table used by the tests below
    await sqlUtil.dropTable(testTable);
    await pool.request().query(
      'CREATE TABLE '+testTable+' (COMPONENT nvarchar(255), SYSTEM_REV nvarchar(255));');
    await insertVals(['Oxygen saturation', 'BldV']);
    await insertVals(['Oxygen saturation^during apnea', 'BldA']);
    await insertVals(['Cardiac heart disease risk', 'Ser/Plas']);
    await insertVals(['C peptide', 'Urine']);
  });

  describe('applyGroup', async function() {
    it('should affect the correct rows', async function() {
      // See test table created in beforeEach
      await sqlUtil.applyGroup(testTable, 'SYSTEM_REV', ['BldA', 'BldV', 'Ser/Plas'],
        'Changed', "COMPONENT like 'Oxygen%'");
      let results = await pool.request().query('SELECT * from '+testTable);
      let rowObjs = results.recordset;
      assert.deepEqual(rowObjs[0],
        {COMPONENT: 'Oxygen saturation', SYSTEM_REV: 'Changed'});
      assert.deepEqual(rowObjs[1],
        {COMPONENT: 'Oxygen saturation^during apnea', SYSTEM_REV: 'Changed'});
      // No change for row 2 because the component did not meet the condition
      assert.deepEqual(rowObjs[2],
        {COMPONENT: 'Cardiac heart disease risk', SYSTEM_REV: 'Ser/Plas'});
      // No change for row 3 because SYSTEM_REV did not have a matching value
      assert.deepEqual(rowObjs[3],
        {COMPONENT: 'C peptide', SYSTEM_REV: 'Urine'});
    });
  });


  /**
   *  Returns the array of values for the given column in the test table.
   */
  async function getColVals(colName) {
    let results = await pool.request().query('select '+colName+ ' from '+testTable);
    let retVals = [];
    for (let row of results.recordset)
      retVals.push(row[colName]);
    return retVals;
  }

  describe('dupColumn', async function() {
    it('should duplicate a column in the table', async function() {
      // See test table created in beforeEach
      await sqlUtil.dupColumn(testTable, 'COMPONENT', 'COMPONENT_REV');
      let results = await pool.request().query('select COMPONENT_REV from '+testTable);
      let revVals = await getColVals('COMPONENT_REV');
      assert.deepEqual(revVals, ['Oxygen saturation', 'Oxygen saturation^during apnea',
        'Cardiac heart disease risk', 'C peptide']);
    });
  }),

  describe('applyGroups', function() {
    it('should handle a default group definition with skipPatterns', async function() {
      // See test table created in beforeEach
      await insertVals(['Immune complex', 'Body fld']);
      await insertVals(['Rheumatoid factor', 'Body fld']);
      let groups = {"Other": {default: true, skipPatterns: ["Cardiac%"]},
       "G1": ["Oxygen saturation", "C peptide"], "G2": ["Rheumatoid factor"]}
      await sqlUtil.dupColumn(testTable, 'COMPONENT', 'COMPONENT_REV');
      await sqlUtil.applyGroups(testTable, 'COMPONENT_REV', groups);
      let revVals = await getColVals('COMPONENT_REV');
      assert.deepEqual(revVals, ['G1', 'G1^during apnea',
        'Cardiac heart disease risk', 'G1', 'Other', 'G2']);
    });
  }),

  after(async function() {
    await pool.close();
    await sqlUtil.closeConnection();
  });
});
