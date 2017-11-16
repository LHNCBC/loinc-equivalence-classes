if object_id('replace_values_with_list_name') is not NULL
   DROP PROCEDURE replace_values_with_list_name;
GO

-- Procedure replace_values_with_list_name:  For the given list name, replaces values in the list's
-- column with the list's name.
-- CAUTION:  Column names are just inserted into the SQL without checking
-- Parameters
--   @listName - the name of the list of values to be replaced with the list name
--   @conditions - an optional condition for the where clause to retrict the records changed
CREATE PROCEDURE replace_values_with_list_name @listName nvarchar(255), @conditions nvarchar(255) = null
as
BEGIN
  print' in replace_values_with_list_name, @listName= '+@listName
  DECLARE @fieldName nvarchar(255);
  EXEC sp_executeSQL N'select @fieldName=LOINC_FIELD from LISTS where LIST_NAME=@listName',
     N'@listName nvarchar(255), @fieldName nvarchar(255) OUTPUT',
	  @listName = @listName, @fieldName = @fieldName OUTPUT
  DECLARE @updateSQL nvarchar(2000);
  SET @updateSQL = 'UPDATE CHEM_EQUIV set '+@fieldName+'_REV='''+@listName+''' where '+@fieldName+
    ' in (select ITEM from LISTS where LIST_NAME = '''+@listName+''')'
  if (@conditions is not null)
    SET @updateSQL = @updateSQL + ' AND ' + @conditions
  EXEC(@updateSQL)
END
GO

-- Copy source table
DECLARE @equivTable nvarchar(255);
SET @equivTable = 'CHEM_EQUIV'
IF OBJECT_ID(@equivTable, 'U') IS NOT NULL
  drop table CHEM_EQUIV;
select * into CHEM_EQUIV FROM LOINC where CLASS='CHEM' and
   PROPERTY not like 'MS%'; -- exclusion

-- METHOD column
-- Create modified copies of columns rather than changing originals.
EXEC dup_column @equivTable, 'METHOD_TYP', 'METHOD_TYP_REV';
UPDATE CHEM_EQUIV set METHOD_TYP_REV = '' where METHOD_TYP_REV not in
  (select ITEM from LISTS where LIST_NAME = 'Chem_Method_Exceptions');

-- SCALE_TYP column
EXEC dup_column @equivTable, 'SCALE_TYP', 'SCALE_TYP_REV'
DECLARE @scaleList nvarchar(50);
EXEC replace_values_with_list_name 'Nar/Nom';

-- TIME_ASPCT column
EXEC dup_column @equivTable, 'TIME_ASPCT', 'TIME_ASPCT_REV'
EXEC replace_values_with_list_name 'Timed collection';

-- SYSTEM column
EXEC dup_column @equivTable, 'SYSTEM', 'SYSTEM_REV';
--DECLARE @oxygen_sat_loincs TABLE (loinc_num nvarchar(20))
--INSERT into @oxygen_sat_loincs
--  select LOINC_NUM from LOINC_DETAIL_TYPE_1 where COMPONENTCORE = 'Oxygen saturation';
DECLARE @componentcoreSQL nvarchar(255);
SET @componentcoreSQL =
  '(select LOINC_NUM from LOINC_DETAIL_TYPE_1 where COMPONENTCORE = '''+'Oxygen saturation'+''')'
DECLARE @restrictionSQL nvarchar(255);
SET @restrictionSQL = 'LOINC_NUM in '+@componentcoreSQL
EXEC replace_values_with_list_name 'Bld O2 Peak', @restrictionSQL
SET @restrictionSQL = 'LOINC_NUM not in '+@componentcoreSQL
EXEC replace_values_with_list_name 'Intravascular -any', @restrictionSQL


-- Build the equivalance class name
ALTER TABLE CHEM_EQUIV ADD EQUIV_CLS  nvarchar(255);
GO
UPDATE CHEM_EQUIV set EQUIV_CLS=CONCAT(COMPONENT,'|',PROPERTY,'|',TIME_ASPCT_REV,'|',SYSTEM_REV,'|',SCALE_TYP_REV,'|',METHOD_TYP_REV);

-- Sample output, paritioning by the equivalence class for counts and to remove entries with a count of 1
select EQUIV_CLS, SYSTEM, SYSTEM_REV, LOINC_NUM, TIME_ASPCT, TIME_ASPCT_REV, SCALE_TYP, SCALE_TYP_REV, METHOD_TYP, METHOD_TYP_REV
  from (select *, count(EQUIV_CLS) over(partition by EQUIV_CLS) as CLS_COUNT From CHEM_EQUIV) t  where CLS_COUNT > 1
