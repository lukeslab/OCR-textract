This package has two functions:

- To extract information from Driver's Licenses and Passports via AWS Textract
- To convert the extracted files to .csv

1. Install Node Modules

npm install

2. If the directory 'input_files' does not exist, create it in the root folder.

mkdir input_files

3. Move the files that require extraction into the directory 'input_files'

4. Run extractText.js

node extractText

5. Responses will be saved in batches/<batchNumber>/json. The JSON directory will be a copy of the 'input_files' directory. If subdirectories exist, they will be copied recursively. JSON responses will be saved into their respective subdirectory.
6. Logs will be saved in batches/<batchNumber>/logs

7. (optional) if you need the json converted into .csv, then open generateCSV.js and change batch directory location to include the correct batch number
8. (optional) Run generateCSV.js

node generateCSV

9. (optional) When you have completed a batch, move the input_files folder into its corresponding batch directory.



Known issues

- If you have more files in your input_files that you want to run, then you have to manually stop the script with control + c. This may result in the total responses receiving being less than the requests made. Additionally, there currently is not a way to specify when to start or end an interation.
