/**
 *  Utility functions used by the various generate_classes.js programs.
 * @param pool A connection pool retured by
 *  require('mssql/msnodesqlv8').connect(...).
 */
module.exports = function sqlUtilFactory(pool) {
  var rtn = {
    /**
     *  Excecutes the given sql string.
     */
    query: async function (sql) {
      console.log(sql);
      return await pool.request().query(sql);
    },


    /**
     *  Returns an object for building and SQL request.
     */
    request: function () {
      return pool.request();
    },


    /**
     *  Drops the given table name, if it exists.  Do not call with data.  The parameter is not
     *  santized.
     */
    dropTable: async function(tableName) {
      return rtn.query("IF OBJECT_ID('"+tableName+"', 'U') IS NOT NULL DROP TABLE "+
         tableName);
    },


    /**
     *  Duplicates a column, creating a new column in the same table.
     * @param tableName the name of the table containing the columns
     * @param soureCol the existing column to be copied
     * @param destCol the new column to be creatd.
     */
    dupColumn: async function(tableName, sourceCol, destCol) {
     return await rtn.request().input('tableName', tableName).
       input('sourceCol', sourceCol).input('destCol', destCol).execute('dup_column');
    },


    /**
     *  Creates a version of column with the all text starting with ^ ("hat")
     *  removed.
     * @param tableName the name of the table containing the column.  This
     *  parameter is not santized, so only pass trusted strings.
     * @param colName the name of the column to duplicate and modify.  The new column will
     *  be named colName +  '_HATLESS'.
     *  This parameter is not santized, so only pass trusted strings.
     */
    createHatless: async function(tableName, colName) {
      let hatlessCol = colName + '_HATLESS';
      await rtn.dupColumn(tableName, colName, hatlessCol);
      return await rtn.query('UPDATE '+tableName+' set '+hatlessCol+" = LEFT("+
        hatlessCol+", PATINDEX('%^%', "+hatlessCol+")-1) where "+hatlessCol+" like '%^%'");
      return
    },


    /**
     *  Applies the group definition to the given column.
     * @param table the table containing the column
     * @param colName the column being revised
     * @param colValues the columnValues to be replaced
     * @param groupValue the new value replacing occurrences of colValues
     * @param condition and additional SQL string to limit the places the
     *  replacement is made.
     */
    applyGroup: async function(tableName, colName, colValues, groupValue, condition) {
      if (colValues.length > 1) {
        let sql = 'UPDATE '+ tableName + ' set '+colName+ " = '"+groupValue+"'";
        let req = rtn.request();
        for (let i=0, len=colValues.length; i<len; ++i) {
          sql += i===0 ? ' WHERE (' : ' OR ';
          let varName = 'var'+i;
          req.input(varName, colValues[i]);
          sql += colName + '=@'+varName;
        }
        sql += ')';
        if (condition)
          sql += ' AND ('+condition+')';
        await req.query(sql);
      }
    },


    /**
     *   Revises a column values to all be the same shared name (groupValue)
     *   except where the existing value matches one of the patterns in
     *   skipPatterns.
     * @param table the table containing the column
     * @param colName the column being revised
     * @param skipPatterns an array of SQL patterns (which can begin or end in %
     *  for limited wildcard matching)
     * @param groupValue the new value replacing values in colName
     */
    applyGroupSkipPatterns: async function(tableName, colName, skipPatterns, groupValue) {
      let sql = 'UPDATE '+ tableName + ' set '+colName+ " = '"+groupValue+"'";
      let req = rtn.request();
      for (let i=0, len=skipPatterns.length; i<len; ++i) {
        sql += i===0 ? ' WHERE ' : ' AND ';
        let varName = 'var'+i;
        req.input(varName, skipPatterns[i]);
        sql += colName + " NOT LIKE @"+varName;
      }
      console.log(sql);
      await req.query(sql);
    },


    /**
     *  Creates the equivalence class column and generates the equivalance class
     *  values.
     * @param tableName the table to which the column will be added
     * @param colNames an array of the column names from which the equivalence
     *  class should be constructed.
     */
    createEquivClasses: async function(tableName, colNames) {
      await rtn.query('ALTER TABLE '+tableName+' ADD EQUIV_CLS nvarchar(255)');
      let sql = 'UPDATE '+tableName+' set EQUIV_CLS=CONCAT('+colNames.join(",'|',")+')';
      await rtn.query(sql);
    },

    /**
     *  Adds a molecular weights column to the given table.
     * @param tableName the table to which the column will be added
     */
    addMolecularWeights: async function (tableName) {
      await rtn.query('ALTER TABLE '+tableName+' ADD MOLECULAR_WEIGHT float');
      await rtn.query('UPDATE '+tableName+' set MOLECULAR_WEIGHT = mw.Molecular_weight_COMBINED from '+
        tableName+' eq left join relma.dbo.PART pt on eq.COMPONENT = pt.PART '+
         ' left join MOLECULAR_WEIGHTS mw on pt.PART_NUM = mw.PartNum where pt.TYPE=1');
    },


    /**
     *  Generates the output spreadsheet.
     * @param equivTable the table with the equivalence class data.  The method
     *  sorts and organizes that data in way more suitable for review and presentation.
     *  Assumption:  equivTable is named in the form "[LOINC_CLASS]_EQUIV" where
     *  LOINC_CLASS is the same string used in the class-specific
     *  sub-directories (so we can find the template files).
     * @param
     */
    equivSpreadsheet: async function(equivTable) {
      let loincCls = equivTable.slice(0, -6); // remove "_EQUIV"
      let clsSubDir = 'class_'+loincCls;
      const path = require('path');
      const exceljs = require('exceljs');
      let workbook = new exceljs.Workbook();
      await workbook.xlsx.readFile(path.join(__dirname, clsSubDir, 'results_template.xlsx'));

      // There are two sheets, one where we include all of the equivalance classes, and one
      // where we include only those classes with a count > 1.  So, we run through the code below twice.
      for (let includeAll of [false, true]) {
        // Sample output, paritioning by the equivalence class for counts and to remove entries with a count of 1
        let sql =
          "IF OBJECT_ID('tempdb..#EQUIV_TEMP') IS NOT NULL DROP TABLE #EQUIV_TEMP\n"+
          "select EQUIV_CLS as heading, * into #EQUIV_TEMP\n"+
          "from (select *, count(EQUIV_CLS) over(partition by EQUIV_CLS) as CLS_COUNT From "+equivTable+") t";
        sql += includeAll? "\n" : " where CLS_COUNT > 1\n";
        sql +=
          "order by EQUIV_CLS\n"+
          "UPDATE #EQUIV_TEMP set heading = '';\n"+
          "EXEC dup_column '#EQUIV_TEMP', 'EQUIV_CLS', 'SORT_ORDER'"
        await rtn.query(sql);

        // Add heading rows with count
        let countField = 'SYSTEM_REV';
        await rtn.query("insert into #EQUIV_TEMP (heading, "+countField+", SORT_ORDER) select EQUIV_CLS,\n"+
          "count(EQUIV_CLS), EQUIV_CLS as EQUIV_CLS from #EQUIV_TEMP group by EQUIV_CLS;");

        // Add blank row after group
        await rtn.query("insert into #EQUIV_TEMP (heading, "+countField+", SORT_ORDER) select '', '',\n"+
          "EQUIV_CLS + '_BLANKROW' from #EQUIV_TEMP where EQUIV_CLS is not null group by EQUIV_CLS;\n");

        // Set other fields to blank in the heading rows and blank rows except SORT_ORDER (used for sorting)
        // This avoids having to respecify the fields in the table.
        await rtn.query("DECLARE @sql varchar(max)=''\n"+
          "select @sql= @sql+case when c.name!='heading' and c.name != 'SORT_ORDER' and c.name != '"+
             countField+"' then c.name + '='''',\n"+
          "' else '' end from tempdb.sys.columns c where object_id =\n"+
          "object_id('tempdb..#EQUIV_TEMP');\n"+
          "select @sql = substring(@sql, 1, (len(@sql) - 2))\n"+  // remove last comma
          "SET @sql = 'UPDATE #EQUIV_TEMP SET '+@sql + ' where COMPONENT is NULL'");

        let colData = await rtn.query("select * from tempdb.sys.columns c where object_id =\n"+
          "object_id('tempdb..#EQUIV_TEMP')");
        let colNames = colData.recordsets[0].reduce((acc, row)=>{acc[row.name] = true; return acc}, {});
        let outputCols = ['EQUIV_CLS', 'LOINC_NUM', 'COMPONENT', 'EXAMPLE_UCUM_UNITS'];
        if (colNames['PROPERTY_REV'])
          outputCols.push('PROPERTY', 'PROPERTY_REV');
        if (colNames['TIME_REV'])
          outputCols.push('TIME_ASPCT', 'TIME_REV');
        if (colNames['SYSTEM_REV'])
          outputCols.push('SYSTEM', 'SYSTEM_REV');
        if (colNames['SCALE_REV'])
          outputCols.push('SCALE_TYP', 'SCALE_REV');
        if (colNames['METHOD_REV'])
          outputCols.push('METHOD_TYP', 'METHOD_REV');
        outputCols.push('LONG_COMMON_NAME', 'MOLECULAR_WEIGHT');
        if (colNames['WARNING'])
          outputCols.push('WARNING');
        outputCols.push('SORT_ORDER');

        let results = await rtn.query("select heading as 'Heading', "+outputCols.join(', ')+
          " from #EQUIV_TEMP order by SORT_ORDER, heading desc");

        // Write sheet
        let sheetName = includeAll ? 'all groups' : 'group size > 1';
        let worksheet = workbook.getWorksheet(sheetName);
        worksheet.spliceRows(0, worksheet.rowCount); // remove existing rows
        outputCols.unshift('Heading');
        worksheet.addRow(outputCols);
        let dataRows =  [];
        for (let rowObj of results.recordsets[0]) {
          let row = [];
          for (let col of outputCols)
            row.push(rowObj[col]);
          dataRows.push(row);
        }
        worksheet.addRows(dataRows);
      }

      // Write the output file
      let d = new Date();
      let month = '' + (d.getMonth() + 1);
      if (month.length < 2)
        month = '0'+month;
      let date = '' +d.getDate();
      if (date.length < 2)
        date = '0' + date;
      let outputFile = loincCls + '_results-'+d.getFullYear()+'-'+month+'-'+date+'.xlsx';
      await workbook.xlsx.writeFile(path.join(__dirname, clsSubDir, outputFile));
    }
  };

  return rtn;
}
