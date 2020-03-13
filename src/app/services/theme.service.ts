import { Injectable } from '@angular/core';
import { DatabaseService } from './db.service';
import { Theme } from '../models/theme';

@Injectable() 
export class ThemeService {
    
    colors: Map<string, string>;
    themes: Array<Theme>
    mainThemes: Array<Theme>;
    tableauColors: Array<string>;

    constructor(private db: DatabaseService) {
        this.themes = new Array<Theme>();
        this.mainThemes = new Array<Theme>();

        this.colors = new Map<string, string>();
        this.tableauColors = ['#a6cee3', '#1f78b4', '#cab2d6', '#6a3d9a', '#e31a1c', '#fb9a99', '#fdbf6f', '#ff7f00', '#b2df8a', '#33a02c', '#ffff99', '#b15928'];
        // this.tableauColors = ['#4e79a7', '#f28e2c', '#edc949', '#76b7b2', '#e15759', '#bae156', '#af7aa1', '#ff9da7', '#9c755f', '#59a14f', '#bab0ab'];
        // For more colors check https://sashat.me/2017/01/11/list-of-20-simple-distinct-colors/ 
        // Or google tableau 20
        
        this.db.getAllMainThemes().then((success) => {
            this.mainThemes = success;
            this.mainThemes.forEach((t: Theme, index: number) => {
                if(index > this.tableauColors.length) {
                    console.warn('Add more colors to color array');
                    return;
                }
                this.colors.set(t.objectId, this.tableauColors[index]);
            });
        });
    }

    getThemes(): Array<{ theme: Theme, color: string}> {
        let result = new Array<{ theme: Theme, color: string }>();
        this.colors.forEach((v: string, k: string) => {
            let theme = this.mainThemes.find((t: Theme) => { return t.objectId === k; });
            result.push({
                theme: theme,
                color: v
            })
        })
        return result;
    }

    isMainTheme(id: string): boolean {
        return this.mainThemes.map((t: Theme) => { return t.objectId; }).includes(id);
    }

    // TODO: How to color people/sources/locations/historicevents?
    getThemeColorForEvent(event: any): string {
        let color: string = '#e7e7e7';
        if(event.themeTypes) {
            color = this.getColorForTheme(event.objectId);
        } else {
            event.themes.forEach((t: any) => {
                if(this.isMainTheme(t.theme)) {
                    color = t.theme.objectId ? this.getColorForTheme(t.theme.objectId) : this.getColorForTheme(t.theme);
                }
            });
        }
        return color;
    }


    getColorForTheme(id: string): string {
        let color = this.colors.get(id);
        return color ? color : '#e7e7e7';
    }
}
