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
import IColorPalette = powerbi.extensibility.IColorPalette;
import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import DataViewTable = powerbi.DataViewTable;
import SortDirection = powerbi.SortDirection;
import VisualUpdateType = powerbi.VisualUpdateType;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import { LineUpVisualSettings } from "./settings";
import { LocalDataProvider, Ranking, Column, IColumnDesc, ISortCriteria, INumberFilter, NumberColumn } from 'lineupjs';
import { LineUp } from 'lineupjs';
import { IOrderedGroup } from "lineupjs/src/model/Group";
import { isNumberColumn } from 'lineupjs/src/model/INumberColumn';

// console.log("Initial log visual");
export class Visual implements IVisual {
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
    private groupInfo: { groups: IOrderedGroup[], colName: any };
    private groups: Column[] = [];
    private filterInfo: { filter: INumberFilter, colName: any };
    private hasGroupCriteriaChanged: boolean;

    constructor(options: VisualConstructorOptions) {

        this.state = new Array<any>();
        this.colorPalette = options.host.colorPalette;
        this.target = options.element;
        this.target.innerHTML = '<div></div>';
        this.settings = new LineUpVisualSettings();
        this.hasDataChanged = false;
        this.sortCriteria = new Array<ISortCriteria>();
        this.hasGroupCriteriaChanged = false;
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
            this.ranking = this.lineup.data.getLastRanking();
            this.handleEventListeners(rows, cols);
        }
    }

    private handleEventListeners(rows: any[], cols: any[]) {

        this.ranking.on(Ranking.EVENT_MOVE_COLUMN, (col: Column, index: number, oldIndex: number) => {
            this.state.length = 0;
            this.ranking.children.slice(3, this.ranking.children.length).forEach((c: Column) => this.state.push(c.desc));
        });

        this.ranking.on(Ranking.EVENT_REMOVE_COLUMN, (col: Column, index: number) => { // Remove the column from state and update it. and also remove it from cols?
        });

        this.ranking.on(Ranking.EVENT_SORT_CRITERIA_CHANGED, (previous: number, current: number) => {
            this.sortCriteria = this.ranking.getSortCriteria();
        });

        // Check for move event
        this.ranking.on(Ranking.EVENT_GROUPS_CHANGED, (previous: number[], current: number[], previousGroups: IOrderedGroup[], currentGroups: IOrderedGroup[]) => {

            if (this.hasGroupCriteriaChanged && this.ranking.getGroups().length > 1) {

                this.groupInfo = { groups: this.ranking.getGroups(), colName: "Total Downtime Minutes SPLY" };
                this.hasGroupCriteriaChanged = false;


                const col: Column = this.ranking.children.find((d) => d.desc.label == "Total Downtime Minutes SPLY");
                if (col) {
                    this.groups.push(col);
                    // return;
                }
                debugger;
                const findDesc = (c: any) => cols.find((d) => d.label === c || (<any>d).column === c);


                const desc = col.desc;

                // if (desc && this.provider.push(this.ranking, desc)) {
                //     return;
                // }
            }
        });

        this.ranking.on(Ranking.EVENT_GROUP_CRITERIA_CHANGED, (previous: Column[], current: Column[]) => {
            this.hasGroupCriteriaChanged = true;
        });

        this.ranking.on(Ranking.EVENT_GROUP_SORT_CRITERIA_CHANGED, (previous: ISortCriteria[], current: ISortCriteria[]) => {
        });

        this.ranking.on(Ranking.EVENT_FILTER_CHANGED, (previous: INumberFilter, current: INumberFilter) => {

            this.ranking.children.forEach((c: Column) => {
                if (c.isFiltered()) {
                    this.filterInfo = { filter: current, colName: c.label };
                }
            });
        })

        this.ranking.on(Ranking.EVENT_WIDTH_CHANGED, (previous: number, current: number) => {
        });

        if (this.hasDataChanged) {
            this.ranking.setSortCriteria(this.sortCriteria);
            this.provider.sort(this.ranking);

            if (this.filterInfo) {
                this.ranking.children.forEach((c: Column) => {
                    if (c.desc.type == "number" && c.label == this.filterInfo.colName) {
                        (<NumberColumn>c).setFilter(this.filterInfo.filter);
                    }
                });
            }

            if (this.groups.length > 0) {
                this.ranking.setGroupCriteria(this.groups);
            }

            // if (this.groups.length > 1) {
            //     debugger;
            //     this.ranking.setGroups(this.groups);
            //     this.ranking.groupBy(this.ranking.children[4]);
            //     console.log(this.ranking);


            //     for (let i = 3; i < this.ranking.children.length; i++) {
            //         console.log("Ranking --> ", this.ranking.children[i].desc);
            //         for (let j = 0; j < this.state.length; j++) {
            //             if (this.state[j].label == this.ranking.children[i].label) {
            //                 this.state[j] = this.ranking.children[i].desc;
            //                 console.log("State -->", this.state[j]);
            //             }
            //         }
            //     }
            // }
        }

        // NOT NEEDED
        // this.ranking.on(Ranking.EVENT_ORDER_CHANGED, (previous: number[], current: number[], previousGroups: IOrderedGroup[], currentGroups: IOrderedGroup[]) => {
        //     console.log("Order change registered");
        // });
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