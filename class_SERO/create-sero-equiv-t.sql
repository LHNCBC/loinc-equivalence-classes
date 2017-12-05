-- Note:  This requires SQLCMD Mode to be turned on
:setvar equivTable "SERO_EQUIV"
:setvar systemTable "SERO_SYSTEM"
:setvar systemGroupCol "System_Rev"


-- Copy source table
EXEC create_equiv_table $(equivTable), 'SERO'
GO

-- System column --
EXEC dup_column $(equivTable), 'SYSTEM', 'SYSTEM_REV'
GO
-- Clean up the system grouping table before using it.  (This only has to run
-- once, but it won't hurt to leave it in case we reload the table.)
UPDATE $(systemTable) set $(systemGroupCol) = RTRIM(LTRIM($(systemGroupCol)));
-- Now use the system table to update SYSTEM_REV in the equivalence table.
EXEC apply_groups $(equivTable), 'SYSTEM_REV', 'SERO_SYSTEM', 'System_Rev';


-- Property column --
EXEC dup_column $(equivTable), 'PROPERTY', 'PROPERTY_REV'
GO
EXEC apply_groups $(equivTable), 'PROPERTY_REV', 'SERO_PROPERTY', 'Property_Rev';

-- METHOD column--
EXEC dup_column $(equivTable), 'METHOD_TYP', 'METHOD_REV'
GO
EXEC apply_groups $(equivTable), 'METHOD_REV', 'SERO_METHOD', 'Method_Rev';
UPDATE $(equivTable) set METHOD_REV='IA_IF_Null*' where
  (METHOD_REV is null or METHOD_REV = '') and
  (COMPONENT like '%[+. ]A[bg]' or COMPONENT like '%[+. ]A[bg][+. ]%')


-- Build the equivalance class name
ALTER TABLE $(equivTable) ADD EQUIV_CLS nvarchar(255);
GO
UPDATE $(equivTable) set EQUIV_CLS=CONCAT(COMPONENT,'|',PROPERTY_REV,'|',SYSTEM_REV,'|',METHOD_REV);

-- Sample output, paritioning by the equivalence class for counts and to remove entries with a count of 1
select EQUIV_CLS, LOINC_NUM, COMPONENT, PROPERTY, PROPERTY_REV, SYSTEM, SYSTEM_REV, METHOD_TYP, METHOD_REV, LONG_COMMON_NAME
  from (select *, count(EQUIV_CLS) over(partition by EQUIV_CLS) as CLS_COUNT From $(equivTable)) t  where CLS_COUNT > 1
  order by EQUIV_CLS
