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
import { thresholdScott, csvParse } from "d3";

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
    private groupCriteria: Column[] = [];
    private groupSortCriteria: ISortCriteria[] = [];
    private filterInfo: { filter: INumberFilter, colName: any };

    constructor(options: VisualConstructorOptions) {

        this.state = new Array<any>();
        this.colorPalette = options.host.colorPalette;
        this.target = options.element;
        this.target.innerHTML = '<div></div>';
        this.settings = new LineUpVisualSettings();
        this.hasDataChanged = false;
        this.sortCriteria = new Array<ISortCriteria>();
    }


    // The first entry in the line up is recorded as VisualUpdateType.Resize in Power BI.
    // Label based matching due to lack of unique identifier
    update(options: VisualUpdateOptions) {

        let removedColumns: any[] = [];
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

        } else if (this.hasDataChanged && options.type == VisualUpdateType.Data) {

            if (cols.length >= oldCols.length) {

                let flag = true;

                cols.forEach((c: any) => {
                    flag = true;
                    this.state.forEach((s: any) => {
                        if (c.label === s.label) {
                            flag = false;
                        }
                    })
                    if (flag) {
                        this.state.push(c);
                    }
                });

            }
            else {
                removedColumns = this.removeColumnPBI(cols);
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

        if (this.groupCriteria.length > 0) {
            let indexToBeRemoved = -1;

            this.groupCriteria.forEach((g: any) => {
                removedColumns.forEach((c: any) => {
                    if (c.label == g.label) {
                        indexToBeRemoved = this.groupCriteria.indexOf(g);
                    }
                });
            });

            if (indexToBeRemoved >= 0) {
                this.groupCriteria.splice(indexToBeRemoved, 1);
            }

            if (this.groupCriteria.length > 0) {
                this.ranking.setGroupCriteria(this.groupCriteria);
                this.ranking.setGroupSortCriteria(this.groupSortCriteria);
            }
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

        //Handled already within group criteria
        this.ranking.on(Ranking.EVENT_GROUPS_CHANGED, (previous: number[], current: number[], previousGroups: IOrderedGroup[], currentGroups: IOrderedGroup[]) => {
        });

        this.ranking.on(Ranking.EVENT_GROUP_CRITERIA_CHANGED, (previous: Column[], current: Column[]) => {
            let groupedColumn: Column;

            if (this.groupCriteria.length > 0) {
                this.groupCriteria.forEach((g: Column) => {
                    current.forEach((c: Column) => {
                        groupedColumn = c;
                        if (g.label == c.label) {
                            groupedColumn = null;
                            return;
                        }
                    })
                    if (groupedColumn) {
                        this.groupCriteria.push(groupedColumn);
                    }
                })
            } else {
                current.forEach((c: Column) => {
                    this.groupCriteria.push(c);
                });
            }
        });

        this.ranking.on(Ranking.EVENT_GROUP_SORT_CRITERIA_CHANGED, (previous: ISortCriteria[], current: ISortCriteria[]) => {

            let gSortCriteria: ISortCriteria;

            if (this.groupSortCriteria.length > 0) {
                this.groupSortCriteria.forEach((g: ISortCriteria) => {
                    current.forEach((c: ISortCriteria) => {
                        gSortCriteria = c;
                        if (g.col.label == c.col.label) {
                            gSortCriteria = null;
                            return;
                        }
                    })
                    if (gSortCriteria) {
                        this.groupSortCriteria.push(gSortCriteria);
                    }
                })
            } else {
                current.forEach((c: ISortCriteria) => {
                    this.groupSortCriteria.push(c);
                });
            }

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
        }
    }

    private removeColumnPBI(cols: any[]) {

        let removedColumns: any[] = [];

        this.state.forEach((s: any) => {
            s.column = -1;
            cols.forEach((c: any) => {
                if (c.label == s.label) {
                    s.column = c.column;
                }
            });
        });

        let indexToBeRemoved = -1;
        debugger;

        for (let i = 0; i < this.state.length; i++) {
            if (this.state[i].column == -1) {
                indexToBeRemoved = i;
                break;
            }
        }

        if (indexToBeRemoved >= 0) {
            removedColumns = this.state.splice(indexToBeRemoved, 1);
        }
        return removedColumns;
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