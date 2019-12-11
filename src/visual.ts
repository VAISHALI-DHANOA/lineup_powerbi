/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IColorPalette = powerbi.extensibility.IColorPalette;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import DataViewTable = powerbi.DataViewTable;
import SortDirection = powerbi.SortDirection;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import { LineUpVisualSettings } from "./settings";
import { LocalDataProvider, Ranking, Column } from 'lineupjs';
import { LineUp } from 'lineupjs';

// console.log("Initial log visual");

export class Visual implements IVisual {
    private visualHost: IVisualHost;
    private readonly target: HTMLElement;
    private readonly colorPalette: IColorPalette;

    private provider: LocalDataProvider;
    private lineup: LineUp;
    private settings: LineUpVisualSettings;
    private colorIndex = 0;
    private ranking: any;

    constructor(options: VisualConstructorOptions) {
        this.visualHost = options.host;
        this.colorPalette = options.host.colorPalette;
        this.target = options.element;
        this.target.innerHTML = '<div></div>';
        this.settings = new LineUpVisualSettings();
        this.init();
    }

    private init() {
        // persistence API
        // get properties (= existing Ranking dump)
        // if ranking dump is available -> restor
        // if not then create fresh lineup
        // initialize LineUp event handler (for each event get a new ranking dump and store it to the persistence API)
    }

    update(options: VisualUpdateOptions) {

        // check for options.type == VisualUpdateType.all => initialize?
        // check for options.type == VisualUpdateType.data => update rows/columns
        // cancel update function for all other types


        // update rows/columns only:
        // diff/merge BI options with existing visual update options
        // update lineup (in worst case: re-initialize lineup with the new config)
        // store updated ranking dump to persistence API

        // console.log("Update visual", options, this.settings);



        const oldSettings = this.settings;
        this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);

        let providerChanged = false;

        //const { rows, cols } = this.extract(options.dataViews[0].table!); // cols = ranking.columns instead of cols = this.extract(options.dataViews[0].table!.cols
        const rows = this.extract(options.dataViews[0].table!).rows;
        const cols = this.ranking.columns;
        const { oldRows, oldCols } = this.getOldData();

        const hasDataChanged = !(rows === oldRows && cols === oldCols);

        if (!this.provider || !this.equalObject(oldSettings.provider, this.settings.provider)) {
            this.provider = new LocalDataProvider(rows, cols, this.settings.provider);
            this.provider.deriveDefault();
            providerChanged = true;

        } else if (hasDataChanged) {
            this.provider.clearColumns();
            cols.forEach((c: any) => this.provider.pushDesc(c));
            this.provider.setData(rows);
            this.provider.deriveDefault();
        }
        if (!this.lineup || !this.equalObject(oldSettings.lineup, this.settings.lineup)) {
            if (this.lineup) {
                this.lineup.destroy();
            }

            this.lineup = new LineUp(<HTMLElement>this.target.firstElementChild!, this.provider, this.settings.lineup);
            this.ranking = this.lineup.data.getLastRanking();
            this.ranking.on(Ranking.EVENT_MOVE_COLUMN, (col: Column, index: number, oldIndex: number) => {
                console.log(col, index, oldIndex);
                console.log(this.ranking); // updated order of columns --> ranking.columns/ ranking.getColumns()

            });
        } else if (providerChanged) {
            this.lineup.setDataProvider(this.provider);

        } else {
            this.lineup.update();
        }
    }

    private getOldData() {
        let rows = null;
        let cols = null;

        if (this.provider != null) {
            rows = this.provider.data;
            cols = this.provider.getColumns();
        }
        return { oldRows: rows, oldCols: cols };
    }

    private extract(table: DataViewTable) {

        const rows = table.rows || [];
        let colors = this.colorPalette;
        const cols = table.columns.map((d) => {
            const c: any = {
                type: 'string',
                label: d.displayName,
                column: d.index
            };
            if (!d.type || d.roles!.row) { // row identifer are always strings
                c.type = 'string';
            } else if (d.type.bool) {
                c.type = 'boolean';
            } else if (d.type.integer || d.type.numeric) {
                c.type = 'number';
                c.colorMapping = colors.getColor(String(this.colorIndex)).value;
                this.colorIndex++;

                const vs = rows.map((r) => <number>r[d.index!]);
                c.domain = [Math.min(...vs), Math.max(...vs)];
            } else if (d.type.dateTime) {
                c.type = 'date';
            } else if (d.type.enumeration) {
                c.type = 'categorical';
                c.categories = d.type.enumeration.members().map((cat) => {
                    return {
                        label: cat.displayName,
                        name: cat.value
                    };
                });
            }
            return c;
        });

        const sort = table.columns.filter((d) => d.sort).sort((a, b) => a.sortOrder! - b.sortOrder!).map((d) => ({ asc: d.sort === SortDirection.Ascending, label: d.displayName }));

        return { rows, cols, sort };
    }
    private equalObject(a: any, b: any) {
        if (a === b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) {
            return false;
        }
        return aKeys.every((k) => a[k] === b[k]);
    }

    private static parseSettings(dataView: DataView): LineUpVisualSettings {
        return <LineUpVisualSettings>LineUpVisualSettings.parse(dataView);
    }

    destroy() {
        // TODO
    }


    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        return LineUpVisualSettings.enumerateObjectInstances(this.settings || LineUpVisualSettings.getDefault(), options);
    }
}