# Notes on procedure for generating equivalence classes

## Set Up
It is assumed that you have two databases on SQL Server (which is required
because of the use of Transact-SQL).  There should be a database "relma" which
contains the latest release of the RELMA database.  (See notes below for how to
import RELMA).  There should also be your own working database for generating
tables from which the output spreadsheets are created.  The SQL Server hostname
should be set in the file src/config.json as the value of the key
"sqlServerHost".  Your working database should be the default database for new
connetions to the server.

In the src directory is a spreadsheet, "molecular_weights.xlsx".  This data must
be loaded into your working database as the table "MOLECULAR_WEIGHTS".  SQL
Server Management Studio contains an import tool that will handle importing an
Excel spreadsheet.  (TBD-- It would be nice to automate this import).

Also under src is a file "common_t.sql" which contains stored procedures which
must be loaded into the database before running the other code.  These can be
loaded by opening the file in SQL Server Management Studio and executing it.

## Generating the equivalence class spreadsheets
The programs for generating the spreadsheets are written in Node.js, and will
connect to your database server using Windows Authentication, so that no log in
is necessary.  However, the Windows Authentication part means that the programs
must be run on Windows (so install Node.js on the Windows system).

To generate all of the equivalence class spreadsheets at once, run:

node src\generate_all.js

To generate the spreadsheet for just one LOINC class, run the individual
generate_classes.js program, e.g.:

node src\class_UA\generate_classes.js

In either case, the output spreadsheets will be written to the "results"
directory (in the root of the package).

The spreadsheets are created from a "results_template.xlsx" file in the
individual class directories, e.g. src\class_UA\results_template.xlsx.  However,
the package used to write out the results spreadsheets does not preserve the
conditional formatting found in the template files, and the conditional
formatting is there to highlight which groups were applied to which LOINC terms.

The conditional formatting can be copied from results_template.xlsx using the
"format painter" tool.  In results_template.xlsx, select all, and then click
"format painter".  Then go to the generated spreadsheet, select the sheet, and
select all again to copied the formatting.  This will need to be done for both
sheets.  Note that there are different templates for each LOINC class.


## Notes on importing the RELMA database
Download and install the RELMA program.  The database file gets placed in
C:\Users\Public\Documents\RELMA\RELMA.MDB.  Open MS SQL Server Management
Studio, and delete the existing tables from database "relma" (for each table,
right click, press d, and then enter).  Right click on relma, and choose
"Tasks -> Import Data".  Select Access, and and the datafile location.  Select
SQL Server Native Client (which uses Windows Integrated Authentication), and
proceed with the import.

