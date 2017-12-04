-- Procedure dup_column:  Creates a copy of a column.
-- CAUTION:  Column names are just inserted into the SQL without checking
-- Parameters:
--   tableName - the name of the table
--   sourceCol - the name of the source column
--   destCol - the name of the new column to be created with a copy of sourceCol
if object_id('dup_column') is not NULL
   DROP PROCEDURE dup_column;
GO
CREATE PROCEDURE dup_column @tableName nvarchar(255), @sourceCol nvarchar(255), @destCol nvarchar(255)
as
BEGIN
  EXEC('ALTER TABLE '+@tableName+' ADD '+@destCol +' nvarchar(255)');
  EXEC('UPDATE '+@tableName+' SET '+@sourceCol+' = '''' where '+@sourceCol+' is null'); -- cleanup
  EXEC('UPDATE '+@tableName+' SET '+@destCol+' = '+@sourceCol);
END;
GO

-- Procedure:  Adds a column with nvarchar(255), deleting it first if it exists
-- already.
-- Parameters:
--   tableName - the name of the table
--   colName - the name of the column
if object_id('add_column') is not NULL
   DROP PROCEDURE add_column;
GO
CREATE PROCEDURE add_column @tableName nvarchar(255), @colName nvarchar(255)
as
BEGIN
  DECLARE @sql nvarchar(255);
  IF COL_LENGTH('plynch.'+@tableName, @colName) IS NOT NULL
  BEGIN
    SET @sql = 'ALTER TABLE MICRO_EQUIV DROP COLUMN'+quotename(@colName);
    EXEC(@sql);
  END
  SET @sql = 'ALTER TABLE MICRO_EQUIV ADD '+quotename(@colName) + ' nvarchar(255)';
  EXEC(@sql);
END;
GO

-- Procedure:  Creates a new equivalence table as a subset of the LOINC table.
-- Parameters:
--   tableName - the name of the table
--   className - the value of the class field for the selected records.  This defines the subset.
if object_id('create_equiv_table') is not NULL
   DROP PROCEDURE create_equiv_table;
GO
CREATE PROCEDURE create_equiv_table @tableName nvarchar(255), @className nvarchar(255)
as
BEGIN
  DECLARE @sql nvarchar(255);
  IF OBJECT_ID(@tableName, 'U') IS NOT NULL
  BEGIN
    SET @sql = N'drop table '+quotename(@tableName);
    EXEC sp_executeSQL @sql
  END;
  SET @sql = N'select * into '+quotename(@tableName)+
    N' from LOINC where CLASS=@className'
  EXEC sp_executeSQL @sql,
    N'@tableName nvarchar(255), @className nvarchar(255)',
    @tableName = @tableName, @className=@className;
END;
GO

-- Procedure:  Applies group information to a subset of the LOINC table.
-- Parameters:
--   equivTable:  The name of the table that contains as subset of the LOINC
--     table (with the same class), e.g. SERO_EQUIV.
--   equivTableCol:  The column (assumed already created with dup_column)
--     containing a copy of one of the LOINC columns (e.g. METHOD, SYSTEM,
--     etc.), to be partially overwritten with group names from the groupTable.
--   groupTable:  The name of the table containing group names to assign to
--     equivTableCol.  Assumption:  There should be a "Name" column whose value
--     can be used to join with the values in equivTableCol.
--   groupTableCol:  The name of the column in groupTable containing the group
--     name that will be used to replace the value in equivTableCol.  Values of
--     " (double quote) mean no replacement is to be done.
if object_id('apply_groups') is not NULL
   DROP PROCEDURE apply_groups;
GO
-- Copies in the group information from the group table
CREATE PROCEDURE apply_groups @equivTable nvarchar(255), @equivTableCol nvarchar(255),
 @groupTable nvarchar(255), @groupTableCol nvarchar(255)
as
BEGIN
  DECLARE @sql nvarchar(255);
 -- UPDATE @groupTable set @groupTableCol = RTRIM(LTRIM(@groupTableCol));
  SET @sql = N'update '+quotename(@groupTable)+
    N' set '+quotename(@groupTableCol) + N'=RTRIM(LTRIM('+quotename(@groupTableCol)+'));'
  EXEC sp_executeSQL @sql,
    N'@groupTable nvarchar(255), @groupTableCol nvarchar(255)',
    @groupTable=@groupTable, @groupTableCol=@groupTableCol;
  SET @sql = N'UPDATE '+ quotename(@equivTable) + N' set '+quotename(@equivTableCol)+
    N' = g.'+quotename(@groupTableCol)+N' from '+quotename(@equivTable)+' eqv left join '+
    quotename(@groupTable)+N' g on eqv.'+quotename(@equivTableCol)+
    N' = g.Name where g.'+quotename(@groupTableCol)+N' != ''"'';'
  EXEC sp_executeSQL @sql,
    N'@equivTable nvarchar(255), @equivTableCol nvarchar(255), @groupTable nvarchar(255), @groupTableCol nvarchar(255)',
	@equivTable=@equivTable, @equivTableCol=@equivTableCol, @groupTable=@groupTable, @groupTableCol=@groupTableCol;
END;
GO

