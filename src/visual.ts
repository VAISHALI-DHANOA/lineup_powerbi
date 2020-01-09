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
import VisualUpdateType = powerbi.VisualUpdateType;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import { LineUpVisualSettings } from "./settings";
import { LocalDataProvider, Ranking, Column, IColumnDesc, ISortCriteria } from 'lineupjs';
import { LineUp } from 'lineupjs';

// console.log("Initial log visual");
export class Visual implements IVisual {
    private host: IVisualHost;
    private readonly target: HTMLElement;
    private readonly colorPalette: IColorPalette;

    private provider: LocalDataProvider;
    private lineup: LineUp;
    private settings: LineUpVisualSettings;
    private colorIndex = 0;
    private ranking: Ranking;
    private state: Array<any>;
    private hasDataChanged: boolean;
    private sortCriteria: ISortCriteria[];

    constructor(options: VisualConstructorOptions) {

        this.host = options.host;
        this.colorPalette = options.host.colorPalette;
        this.target = options.element;
        this.target.innerHTML = '<div></div>';
        this.settings = new LineUpVisualSettings();
        this.state = new Array<any>();
        this.hasDataChanged = false;
    }


    // The first entry in the line up is recorded as VisualUpdateType.Resize in Power BI.
    // Label based matching due to lack of unique identifier
    update(options: VisualUpdateOptions) {

        const oldSettings = this.settings;
        this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);

        let providerChanged = false;

        let { rows, cols } = this.extract(options.dataViews[0].table!);

        let { oldRows, oldCols } = this.getOldData();

        this.hasDataChanged = !(rows === oldRows && cols === oldCols);

        if (!this.provider || !this.equalObject(oldSettings.provider, this.settings.provider)) {
            this.provider = new LocalDataProvider(rows, cols, this.settings.provider);
            this.provider.deriveDefault();
            providerChanged = true;

        } else if (this.hasDataChanged) {


            if (cols.length == oldCols.length) {
                if (this.state.length == 0) {
                    this.state.push(cols[cols.length - 1]);

                }
            } else if (cols.length > oldCols.length) {
                this.state.push(cols[cols.length - 1]);

            } else {
                this.removeColumnPBI(cols);
            }

            this.provider.clearColumns();
            this.state.forEach((c: any) => {
                this.provider.pushDesc(c);
            });

            this.provider.setData(rows);
            this.provider.deriveDefault();
        }

        if (!this.lineup || !this.equalObject(oldSettings.lineup, this.settings.lineup)) {
            this.lineup = new LineUp(<HTMLElement>this.target.firstElementChild!, this.provider, this.settings.lineup);

        } else if (providerChanged) {
            this.lineup.setDataProvider(this.provider);

        } else {
            this.lineup.update();
        }

        if (this.lineup) {
            debugger;
            this.ranking = this.lineup.data.getLastRanking();
            this.handleEventListeners();
        }
    }

    private handleEventListeners() {

        this.ranking.on(Ranking.EVENT_MOVE_COLUMN, (col: Column, index: number, oldIndex: number) => {
            console.log("Move column event registered");
            this.state.length = 0;
            this.ranking.children.slice(3, this.ranking.children.length).forEach((c: Column) => this.state.push(c.desc));
        });

        this.ranking.on(Ranking.EVENT_REMOVE_COLUMN, (col: Column, index: number) => { // Remove the column from state and update it. and also remove it from cols?
            console.log("Remove column event registered");
        });

        this.ranking.on(Ranking.EVENT_FILTER_CHANGED, (previous: number, current: number) => {

        });

        this.ranking.on(Ranking.EVENT_SORT_CRITERIA_CHANGED, (previous: number, current: number) => {
            console.log("Sorting registered");
            this.sortCriteria = this.ranking.getSortCriteria();
        });

        if (this.hasDataChanged) {
            this.ranking.setSortCriteria(this.sortCriteria);
            this.provider.sort(this.ranking);
        }
    }

    private removeColumnPBI(cols: any[]) {

        this.state.forEach((s: any) => {
            s.column = -1;
            cols.forEach((c: any) => {
                if (c.label == s.label) {
                    s.column = c.column;
                }
            });
        });

        let indexToBeRemoved = -1;

        for (let i = 0; i < this.state.length; i++) {
            if (this.state[i].column == -1) {
                indexToBeRemoved = i;
                break;
            }
        }

        if (indexToBeRemoved) {
            this.state.splice(indexToBeRemoved, 1);
        }
    }

    private getOldData() {
        let rows = null;
        let cols = new Array<any>();

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