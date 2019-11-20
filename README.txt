+Notes on procedure for generating equivalence classes

[Note:  The first part of this document describes the old appraoch.  There is a
new approach under development which is described at the end, and is to be followed
instead for certain classes.]

The SQL routines are written in Transact-SQL, originally selected because Clem
requested the use of the "partition by" syntax.  The code now uses temporary
tables, so conversion to something like Ruby might be difficult.  There are some
common, shared routines in common_t.sql, and then each subset of LOINC (CHEM,
UA, etc.) has its own create..._t.sql file for generating result sets.  There is
some common code in these individual files, which I would like to extract, but
due to limitations with Transact-SQL (e.g. with dynamic SQL and temporary
tables) it proved sufficiently difficult and convoluted (though not
impossible, I think) that I gave up after a couple of hours.

The code is run in Microsoft SQL Server Management Studio, and the database
server is ceb-mssql.  I have two databases there, "relma", which is an import* of
the Access database in the RELMA distribution, and "plynch" which is my primary
database for this work.  Into "plynch" I have imported from RELMA (and/or the
main LOINC distributions spreadsheet) the LOINC table and the
LOINC_DETAIL_EQUIV_1 table.

For each subset of LOINC (which is created based on LOINC classes, e.g. CHEM),
I have been given a spreadsheet of "input" data with modified versions of the LOINC
SYSTEM, METHOD, and PROPERTY columns (usually named "SYSTEM_Rev", "METHOD_Rev",
etc., and some other tables.  These input spreadsheets are located in an "input"
directory on the subset's directory, e.g. class_CHEM/input.  The sheets needed
by the SQL code (not all sheets are needed) are imported into my plynch database
prefixed with the class name, e.g. CHEM_METHOD for the sheet with the
modifications to the METHOD name for the CHEM subset, etc.  The import is
achieved by right-clicking on the "plynch" database in MS SQL Server Management
Studio, choosing "Tasks", and then "Import Data", which brings up a tool lets
you import from an Excel spreadsheet into SQL Server.  When selecting the
destination, pick the last option in the list ("SQL Server native client").

The common_t.sql needs to be run to load the stored procedures (if those are
lost or modified), and then the individual create..._t.sql files are run one at
a time for each subset.  In order to run those, which rely on SQLCMD mode (for
:setvar) under the Query menu choose "SQLCMD Mode" for that query tab.

The result set for the code in the create..._t.sql files includes only output
for groups of size > 1, but Clem likes to see it both ways, so after generating
that output, find the line that says,  "where CLS_COUNT > 1", comment that part
out (with --), and run the script again to get all the result sets.

The result sets get put into an Excel file to send to Clem.  The Excel files for
each set have formatting to hide columns and to highlight values that have
changed (e.g. between METHOD and METHOD_REV).  So, it best to start with the
latest results spreadsheet (which are saved in the "results" subdirectories),
save it under the new file name with the current date, clear the old data, and
then paste in the new data.  When clearing the data, use control-a to select all
and then hit backspace, rather than deleting all rows, which also removes the
format rules.  If you want to delete rows (e.g. if the new data size is smaller
and you don't want extra blank rows at the bottom), do not delete the first two
rows, which contain the formatting rules, but just clear those.  Perhaps the
next time this is done, a blank template can be created for each subset as a
starting point.  Note that the columns for each subset differs for one or two of
the subsets.  Several have the same columns, but not all.

To avoid accidentally editing previously generated result sets or input files,
run chmod 444 on the input and results directories when done.

* Notes on importing the relma database:  Download and install the RELMA
program.  The database file gets placed in
C:\Users\Public\Documents\RELMA\RELMA.MDB.  Open MS SQL Server Management
Studio, and delete the existing tables from database "relma" (for each table,
right click, press d, and then enter).  Right click on relma, and choose
"Tasks -> Import Data".  Select Access, and and the datafile location.  Select
SQL Server Native Client (which uses Windows Integrated Authentication), and
proceed with the import.

New Approach (used for classes ABXBACT, ALLERGY, CELLMARK, COAG, CHEM, DRUG/TOX, and MICRO):
To try to reduce the work, and also to not rely on a fixed (and outdated) set of
LOINC Parts, a new approach is being developed.  Currently this
still relies on some of the stored procedures in common_t.sql, so those need to
be loaded as described above.  The next stop is to run (from a Windows cmd
shell, so it can use Windows authentication to access the databases)
  node class_DrugTox\generate_classes.js
This will output a results spreadsheet in the class_[classname] directory.
Unfortunately, although it is based on results_template.xlsx, the conditional
formatting is lost, so the output spreadsheet needs to have that restored before it
is sent.

The conditional formatting can be copied from results_template.xlsx using the
"format painter" tool.  In results_template.xlsx, select all, and then click
"format painter".  Then go to the generated spreadsheet, select the sheet, and
select all again to copied the formatting.  This will need to be done for both
sheets.
