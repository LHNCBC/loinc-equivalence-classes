const assert = require('assert');
const sql = require('mssql/msnodesqlv8');
const loincUtil = require('../src/util');

describe('util.js', function() {
  describe('applyGroup', async function(done) {
    let pool, sqlUtil;
    let testTable = 'TEST_TABLE';

    /**
     *  Inserts values into table testTable.  It is assumed that the values
     *  in rowVals have appropriate datatypes for the table's columns.
     */
    async function insertVals(rowVals) {
      let sql = "INSERT INTO "+testTable+" VALUES ('";
      sql += rowVals.join("', '") + "')";
      await pool.request().query(sql);
    }

    before(async function() {
      pool = await sql.connect({options: {trustedConnection: true}, server: 'ceb-mssql'});
      sqlUtil = await loincUtil.sqlUtil();
    });

    it('should affect the correct rows', async function() {
      // Create some test data
      await sqlUtil.dropTable(testTable);
      await pool.request().query(
        'CREATE TABLE '+testTable+' (COMPONENT nvarchar(255), SYSTEM_REV nvarchar(255));');
      await insertVals(['Oxygen saturation', 'BldV']);
      await insertVals(['Oxygen saturation^during apnea', 'BldA']);
      await insertVals(['Cardiac heart disease risk', 'Ser/Plas']);
      await insertVals(['C peptide', 'Urine']);
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

    after(async function() {
      await pool.close();
      await sqlUtil.closeConnection();
    });
  });
});
