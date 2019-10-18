 #LineUp.js as PowerBI Visual


[![License: MIT][mit-image]][mit-url]

LineUp is an interactive technique designed to create, visualize and explore rankings of items based on a set of heterogeneous attributes. This is a [PowerBI Custom Visual](https://github.com/Microsoft/PowerBI-Visuals) wrapper around the JavaScript library [LineUp.js](https://github.com/lineupjs/lineupjs). Details about the LineUp visualization technique can be found at [http://lineup.caleydo.org](http://lineup.caleydo.org).

##Develop Power BI custom visual

Custom visuals are visualizations that are not provided by the [Microsoft Marketplace](https://appsource.microsoft.com/en-us/marketplace/apps?product=power-bi-visuals "Microsoft Marketplace") per se. In order to adapt visualizations to your wishes and to achieve a customized reporting system, you can therefore develop your own visualizations.

To learn how to create Power BI Visuals, we refer to the following link: https://microsoft.github.io/PowerBI-visuals/docs/overview/

##Dependencies
Before running command line tools, you must install NodeJS or check that node is installed. **Note**: NodeJS 5.++ is required - [Download NodeJS](https://nodejs.org/en/ "Download NodeJS")

`node --version`

Further, check for your core-js version or update it to

`npm install --save core-js@^3`

To install [Power BI Visuals util dataviewutils](https://github.com/microsoft/powerbi-visuals-utils-dataviewutil "Power BI Visuals util dataviewutils")
`npm install powerbi-visuals-utils-dataviewutils --save`


##Development Environment

To install the command line tools, use the following command
`npm install -g powerbi-visuals-tools`

To check if it was correctly installed

`pbiviz`

To enable live preview, visual assets need to be served on a trusted https server. This is a one time setup. Run the following command to open the [certificate](https://github.com/microsoft/PowerBI-visuals/blob/master/tools/CertificateAddWindows.md "certificate") and start the process.

`pbiviz --install-cert`

Create a new visual with a single command.

`pbiviz new MyVisualName`

This command will create a new folder in your current directory and generate a basic template for your visual.

Then you need to download all dependencies listed in the _package.json_ file using this command:

`npm  install`

## Testing visual in Power BI
**Enable Live Preview**
You can test your visual live in reports and dashboards in the PowerBI service using the live developer visual, once it is enabled. To [enable live preview](https://github.com/microsoft/PowerBI-visuals/blob/master/tools/DebugVisualSetup.md "enable live preview") of your custom visual follow these steps

1. Go to Settings in the gear menu.
2. Click on Developer and check the Enable developer visual for testing checkbox.
3. Create a new report and select the Developer Visual in the Visualizations pane.

**Note**: Make sure `pbiviz start` is running.

**Create and import .pbiviz file**
Custom visuals are packaged as a single **.pbiviz** file and can be imported into a Power BI report. To import LineUp as a custom visual, you can import the **.pbiviz** file to your Microsoft Power BI report. If you intend to make changes to the visual, you can make the changes and create a new **.pbiviz** file in the _dist/_ directory by using the following command line.

`pbiviz package`

For the import of the custom visual to Microsoft Power BI, select the ellipses from the bottom of the Visualizations pane and select **Import from file** from the dropdown. You are ready to use LineUp as a Microsoft Power BI custom visual.

**Note**: A custom visual is always added to one  specific report. Therefore, if it should be used for another report, you have to import the **.pbiviz** file again.

**Note**: An old version of LineUp is already available in the certified Microsoft Marketplace and is named [Table Sorter](https://appsource.microsoft.com/en-us/product/power-bi-visuals/WA104380796?tab=Overview "Table Sorter"). Further, it is available on [Github](https://github.com/microsoft/PowerBI-visuals-TableSorter?tab=Overview "Table Sorter").

##Examples
**Supply Quality Analysis**
Once imported, the LineUp Power BI visual can be used to display and rank your data. Click on the link to see a published report on Power BI using the sample data set 'Supply Quality Analysis' and LineUp: https://app.powerbi.com/view?r=eyJrIjoiMWYzNWE1Y2YtMGE2OS00ZDEyLWE2YzQtYmY3Y2QzYjk4ZWZjIiwidCI6ImE2OWI4YzBkLWViMTgtNDI4MC04MDRhLWFhYmQ1MmYyNzFjNiIsImMiOjh9

##Link Collection
- **LineUp.js: Visual Analysis of Multi-Attribute Rankings:** https://github.com/lineupjs/lineupjs
- **Power BI Visuals:** https://microsoft.github.io/PowerBI-visuals/docs/overview/
- **Power BI Marketplpace:** https://appsource.microsoft.com/en-us/marketplace/apps?product=power-bi-visuals
- **Power BI Visual Tools (pbiviz) - Usage Guide**: https://microsoft.github.io/PowerBI-visuals/docs/quickstarts_old/step-by-step-on-how-to-create-your-first-visual/
- **Tutorial: Developing a Power BI visual**: https://docs.microsoft.com/de-de/power-bi/developer/visuals/custom-visual-develop-tutorial
- **Table Sorter (Version 2.0.1.0) in the Microsoft Marketplace:** https://appsource.microsoft.com/en-us/product/power-bi-visuals/WA104380796?tab=Overview
- **Table Sorter (Version 2.0.1.0) on Github:** https://github.com/microsoft/PowerBI-visuals-TableSorter
- **Example of another custom visual (Circle Card):** https://github.com/Microsoft/PowerBI-visuals-circlecard


##Authors

 * Samuel Gratzl (@sgratzl)
 * Holger Stitz (@thinkh)
 * Vaishali Dhanoa (@VAISHALI-DHANOA)
 * Conny Walchshofer (@ConnyWalchshofer)


[mit-image]: https://img.shields.io/badge/License-MIT-yellow.svg
[mit-url]: https://opensource.org/licenses/MIT
