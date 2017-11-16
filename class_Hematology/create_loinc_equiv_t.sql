IF OBJECT_ID('LOINC_EQUIV', 'U') IS NOT NULL 
  drop table LOINC_EQUIV;
select * into LOINC_EQUIV FROM LOINC_EQUIV_INPUT;
-- Create modified copies of columns before proceding.
ALTER TABLE LOINC_EQUIV ADD SYSTEM_REV nvarchar(255);
ALTER TABLE LOINC_EQUIV ADD METHOD_REV  nvarchar(255);
GO
UPDATE LOINC_EQUIV SET SYSTEM_REV = SYSTEM;
UPDATE LOINC_EQUIV SET METHOD_TYP = '' where METHOD_TYP is null; -- cleanup
UPDATE LOINC_EQUIV SET METHOD_REV = METHOD_TYP;


UPDATE LOINC_EQUIV set METHOD_REV = '' where METHOD_REV not in ('IFCC', 'JDS/JSCC', 'Estimated');
UPDATE LOINC_EQUIV set SYSTEM_REV = 'Bld R' where COMPONENT in ('Deoxyhemoglobin/Hemoglobin.total');
UPDATE LOINC_EQUIV set SYSTEM_REV = 'Bld R or L' where SYSTEM in ('Bld', 'BldA', 'BldC', 'BldV', 'BldMV') and
   COMPONENT in ('Hemoglobin', 'Hematocrit');

-- Cord blood
UPDATE LOINC_EQUIV set SYSTEM_REV = 'BldCo R or L' where SYSTEM in ('BldCo', 'BldCoA', 'BldCoV') and
   COMPONENT in ('Hemoglobin', 'Hematocrit');
   
ALTER TABLE LOINC_EQUIV ADD EQUIV_CLS  nvarchar(255);
GO
UPDATE LOINC_EQUIV set EQUIV_CLS=CONCAT(COMPONENT,'|',PROPERTY,'|',TIME_ASPCT,'|',SYSTEM_REV,'|',SCALE_TYP,'|',METHOD_REV);

select * from (select *, count(EQUIV_CLS) over(partition by EQUIV_CLS) as CLS_COUNT From LOINC_EQUIV) t where CLS_COUNT > 1