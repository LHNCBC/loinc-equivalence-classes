-- Note:  This requires SQLCMD Mode to be turned on
:setvar equivTable "HEMBC_EQUIV"

-- Copy source table
EXEC create_equiv_table $(equivTable), 'HEM/BC'
GO

-- System column --
EXEC dup_column $(equivTable), 'SYSTEM', 'SYSTEM_REV'
GO
EXEC apply_groups $(equivTable), 'SYSTEM_REV', 'HEMBC_SYSTEM', 'System_Rev_1';


-- Property column --
EXEC dup_column $(equivTable), 'PROPERTY', 'PROPERTY_REV'
GO
EXEC apply_groups $(equivTable), 'PROPERTY_REV', 'HEMBC_PROPERTY', 'Property_Rev';


-- Build the equivalance class name
ALTER TABLE $(equivTable) ADD EQUIV_CLS nvarchar(255);
GO
UPDATE $(equivTable) set EQUIV_CLS=CONCAT(COMPONENT,'|',PROPERTY_REV,'|',SYSTEM_REV,'|Method_Any');

-- Sample output, paritioning by the equivalence class for counts and to remove entries with a count of 1
select EQUIV_CLS, LOINC_NUM, COMPONENT, PROPERTY, PROPERTY_REV, SYSTEM, SYSTEM_REV, METHOD_TYP, LONG_COMMON_NAME
  from (select *, count(EQUIV_CLS) over(partition by EQUIV_CLS) as CLS_COUNT From $(equivTable)) t  where CLS_COUNT > 1
  order by EQUIV_CLS
