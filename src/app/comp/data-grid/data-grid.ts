// ...existing imports...
import Chart from 'chart.js/auto';
import { ColDef, ColGroupDef } from 'ag-grid-community';
import { ApiService } from '../../services/api.service';
import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter } from '@angular/core';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-data-grid',
  standalone: false,
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.css'
})
export class DataGrid implements OnInit, OnChanges {
  // ...existing code...

  showToast(message: string) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toast-message');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.classList.remove('hidden');
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
  }
  @Output() graphOutput = new EventEmitter<{ time?: any[]; abs?: any[]; noDownsample?: boolean }>();
  private chartInstance: Chart | null = null;

  private destroyChart() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }
  // Modal state for graph plotting
  // Modal/chart logic removed; modal now handled by parent component
  rowData: any[] = [];
  columnDefs: (ColDef | ColGroupDef)[] = [
  { headerName: 'Patient', field: 'patient', filter: 'agTextColumnFilter', sortable: true, minWidth: 120, maxWidth: 160 },
  { headerName: 'Device', field: 'device', filter: 'agTextColumnFilter', sortable: true, minWidth: 120, maxWidth: 160, hide: true },
  { headerName: 'Synced Date ', field: 'date', filter: 'agDateColumnFilter', sortable: true, minWidth: 120, maxWidth: 140 },
    {
      headerName: 'Left Hand Device',
      groupId: 'shimmer1',
      children: [
        { headerName: 'Start Time (GMT)', field: 'shimmer1_recorded_timestamp', filter: 'agTextColumnFilter', sortable: true, sort: 'desc', comparator: (_a, _b, nodeA, nodeB) => (nodeA.data?.startRecordedSortMs ?? 0) - (nodeB.data?.startRecordedSortMs ?? 0), minWidth: 180, maxWidth: 220 },
        { headerName: 'End Time (GMT)', field: 'shimmer1_end_recorded_timestamp', filter: 'agTextColumnFilter', sortable: true, minWidth: 180, maxWidth: 220 },
        { headerName: 'Day', field: 'shimmer1_shimmer_day', filter: 'agTextColumnFilter', sortable: true, minWidth: 80, maxWidth: 100, hide: true},
        { headerName: 'Accel Var', field: 'shimmer1_accel_var', filter: 'agNumberColumnFilter', sortable: true, minWidth: 110, maxWidth: 130, hide: true },
        // { headerName: 'Time', field: 'shimmer1_time', filter: 'agTextColumnFilter', sortable: true, minWidth: 100, maxWidth: 120 },
        { headerName: 'Full File Name', field: 'shimmer1_full_file_name', filter: 'agTextColumnFilter', sortable: true, minWidth: 220, maxWidth: 320, hide: true },
        { headerName: 'MAC Address', field: 'shimmer1_mac_address', filter: 'agTextColumnFilter', sortable: true, minWidth: 140, maxWidth: 180 },
        {
          headerName: '',
          field: 'shimmer1_graph',
          cellRenderer: (params: any) => {
            const fullFileName = params.data.shimmer1_full_file_name;
            if (!fullFileName) return '';
            const btn = document.createElement('button');
            btn.className = 'ag-btn ag-btn-graph themed-graph-btn';
            btn.title = 'Show Graph';
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><polyline points="6 17 9 13 13 17 18 10"/></svg>`;
            btn.onclick = () => {
              btn.disabled = true;
              btn.style.opacity = '0.5';
              forkJoin({
                time: this.apiService.getDecodedFieldDirect(fullFileName, 'timestampCal'),
                abs: this.apiService.getDecodedFieldDirect(fullFileName, 'Accel_WR_Absolute')
              }).subscribe({
                next: (result) => {
                  console.log('API Response for Shimmer 1:', result);
                  console.log('Time data:', result.time);
                  console.log('Abs data:', result.abs);
                  
                  // Send raw data - downsampling will be handled in the modal
                  this.graphOutput.emit({
                    time: result.time?.values || [],
                    abs: result.abs?.values || []
                  });
                  btn.disabled = false;
                  btn.style.opacity = '1';
                },
                error: (err) => {
                  console.error('Error fetching graph data:', err);
                  btn.disabled = false;
                  btn.style.opacity = '1';
                  alert('Failed to load graph data');
                }
              });
            };
            return btn;
          },
          minWidth: 40, maxWidth: 60
        },
        {
          headerName: '',
          field: 'shimmer1_uwb_graph',
          cellRenderer: (params: any) => {
            const fullFileName = params.data.shimmer1_full_file_name;
            if (!fullFileName) return '';
            const btn = document.createElement('button');
            btn.className = 'ag-btn ag-btn-uwb themed-graph-btn';
            btn.title = 'Show UWB Distance Graph';
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12H3"/><path d="m8 8-4 4 4 4"/><path d="m16 16 4-4-4-4"/></svg>`;
            btn.onclick = () => {
              btn.disabled = true;
              btn.style.opacity = '0.5';
              forkJoin({
                time: this.apiService.getDecodedFieldDirect(fullFileName, 'timestampCal'),
                uwbDis: this.apiService.getDecodedFieldDirect(fullFileName, 'uwbDis')
              }).subscribe({
                next: (result) => {
                  console.log('UWB API Response for Shimmer 1:', result);
                  console.log('Time data:', result.time);
                  console.log('UWB Distance data:', result.uwbDis);
                  // Decouple emission to prevent recursion
                  setTimeout(() => {
                    this.graphOutput.emit({
                      time: result.time?.values || [],
                      abs: result.uwbDis?.values || [],
                      noDownsample: true
                    });
                    btn.disabled = false;
                    btn.style.opacity = '1';
                  }, 0);
                },
                error: (err) => {
                  console.error('Error fetching UWB graph data:', err);
                  btn.disabled = false;
                  btn.style.opacity = '1';
                  alert('Failed to load UWB graph data');
                }
              });
            };
            return btn;
          },
          minWidth: 40, maxWidth: 60
        },
        {
          headerName: '',
          field: 'shimmer1_show_file',
          minWidth: 40,
          maxWidth: 60,
          cellRenderer: (params: any) => {
            const fullFileName = params.data.shimmer1_full_file_name;
            if (!fullFileName) return '';

            const btn = document.createElement('button');
            btn.className = 'ag-btn ag-btn-action themed-action-btn';
            btn.title = 'Show Shimmer 1 File Name';
            btn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
              viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>`;

            btn.onclick = () => {
              this.showToast('Shimmer 1 File:\n' + fullFileName);
            };

            return btn;
          }
        },
      ]
    },
    {
      headerName: 'Right Hand Device',
      groupId: 'shimmer2',
      children: [
        { headerName: 'Start Time (GMT)', field: 'shimmer2_recorded_timestamp', filter: 'agTextColumnFilter', sortable: true, minWidth: 180, maxWidth: 220 },
        { headerName: 'End Time (GMT)', field: 'shimmer2_end_recorded_timestamp', filter: 'agTextColumnFilter', sortable: true, minWidth: 180, maxWidth: 220 },
        { headerName: 'Day', field: 'shimmer2_shimmer_day', filter: 'agTextColumnFilter', sortable: true, minWidth: 80, maxWidth: 100 , hide: true},
        { headerName: 'Accel Var', field: 'shimmer2_accel_var', filter: 'agNumberColumnFilter', sortable: true, minWidth: 110, maxWidth: 130, hide: true },
        // { headerName: 'Time', field: 'shimmer2_time', filter: 'agTextColumnFilter', sortable: true, minWidth: 100, maxWidth: 120 },
        { headerName: 'Full File Name', field: 'shimmer2_full_file_name', filter: 'agTextColumnFilter', sortable: true, minWidth: 220, maxWidth: 320, hide: true },
        { headerName: 'MAC Address', field: 'shimmer2_mac_address', filter: 'agTextColumnFilter', sortable: true, minWidth: 140, maxWidth: 180 },
        {
          headerName: '',
          field: 'shimmer2_graph',
          cellRenderer: (params: any) => {
            const fullFileName = params.data.shimmer2_full_file_name;
            if (!fullFileName) return '';
            const btn = document.createElement('button');
            btn.className = 'ag-btn ag-btn-graph themed-graph-btn';
            btn.title = 'Show Graph';
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><polyline points="6 17 9 13 13 17 18 10"/></svg>`;
            btn.onclick = () => {
              btn.disabled = true;
              btn.style.opacity = '0.5';
              forkJoin({
                time: this.apiService.getDecodedFieldDirect(fullFileName, 'timestampCal'),
                abs: this.apiService.getDecodedFieldDirect(fullFileName, 'Accel_WR_Absolute')
              }).subscribe({
                next: (result) => {
                  console.log('API Response for Shimmer 2:', result);
                  console.log('Time data:', result.time);
                  console.log('Abs data:', result.abs);
                  
                  // Send raw data - downsampling will be handled in the modal
                  this.graphOutput.emit({
                    time: result.time?.values || [],
                    abs: result.abs?.values || []
                  });
                  btn.disabled = false;
                  btn.style.opacity = '1';
                },
                error: (err) => {
                  console.error('Error fetching graph data:', err);
                  btn.disabled = false;
                  btn.style.opacity = '1';
                  alert('Failed to load graph data');
                }
              });
            };
            return btn;
          },
          minWidth: 40, maxWidth: 60
        },
        {
          headerName: '',
          field: 'shimmer2_uwb_graph',
          cellRenderer: (params: any) => {
            const fullFileName = params.data.shimmer2_full_file_name;
            if (!fullFileName) return '';
            const btn = document.createElement('button');
            btn.className = 'ag-btn ag-btn-uwb themed-graph-btn';
            btn.title = 'Show UWB Distance Graph';
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12H3"/><path d="m8 8-4 4 4 4"/><path d="m16 16 4-4-4-4"/></svg>`;
            btn.onclick = () => {
              btn.disabled = true;
              btn.style.opacity = '0.5';
              forkJoin({
                time: this.apiService.getDecodedFieldDirect(fullFileName, 'timestampCal'),
                uwbDis: this.apiService.getDecodedFieldDirect(fullFileName, 'uwbDis')
              }).subscribe({
                next: (result) => {
                  console.log('UWB API Response for Shimmer 2:', result);
                  console.log('Time data:', result.time);
                  console.log('UWB Distance data:', result.uwbDis);
                  // Decouple emission to prevent recursion
                  setTimeout(() => {
                    this.graphOutput.emit({
                      time: result.time?.values || [],
                      abs: result.uwbDis?.values || [],
                      noDownsample: true
                    });
                    btn.disabled = false;
                    btn.style.opacity = '1';
                  }, 0);
                },
                error: (err) => {
                  console.error('Error fetching UWB graph data:', err);
                  btn.disabled = false;
                  btn.style.opacity = '1';
                  alert('Failed to load UWB graph data');
                }
              });
            };
            return btn;
          },
          minWidth: 40, maxWidth: 60
        },
        {
          headerName: '',
          field: 'shimmer2_show_file',
          minWidth: 40,
          maxWidth: 60,
          cellRenderer: (params: any) => {
            const fullFileName = params.data.shimmer2_full_file_name;
            if (!fullFileName) return '';

            const btn = document.createElement('button');
            btn.className = 'ag-btn ag-btn-action themed-action-btn';
            btn.title = 'Show Shimmer 2 File Name';
            btn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
              viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>`;

            btn.onclick = () => {
              this.showToast('Shimmer 2 File:\n' + fullFileName);
            };

            return btn;
          }
        },
      ],
    }
  ];


  @Input() initialFilter: string = '';
  @Input() isLoggedIn = false;
  @Input() isAdmin = false;
  quickFilterText: string = '';
  isLoading: boolean = true;
  private allRowData: any[] = [];

  constructor(private apiService: ApiService) {
    this.syncReviewColumns();
  }

  formatRecordedTimestamp(timestamp: string): string {
    if (!timestamp) return '';
    // recordedTimestamp / endRecordedTimestamp from DDB (DecodedFileMeta):
    // timestampCal[0] and timestampCal[-1] as UTC ISO strings from POST /decode-and-store/
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  /** Latest hand start time on the row (ms since epoch), for default newest-first sort. */
  private rowStartRecordedSortMs(s1: any, s2: any): number {
    const times = [s1?.recordedTimestamp, s2?.recordedTimestamp]
      .filter(Boolean)
      .map((ts) => new Date(ts).getTime())
      .filter((t) => !Number.isNaN(t));
    return times.length ? Math.max(...times) : 0;
  }

  private rowVisibleFlag(s1: any, s2: any): boolean {
    if (s1?.full_file_name && s1.visible_flag === false) return false;
    if (s2?.full_file_name && s2.visible_flag === false) return false;
    return true;
  }

  private rowAdminComment(s1: any, s2: any): string {
    const c1 = s1?.admin_comment;
    const c2 = s2?.admin_comment;
    if (c1 != null && c1 !== '') return String(c1);
    if (c2 != null && c2 !== '') return String(c2);
    return '';
  }

  private syncReviewColumns(): void {
    this.columnDefs = this.columnDefs.filter((c) => (c as ColGroupDef).groupId !== 'review');

    if (this.isAdmin) {
      this.columnDefs = [...this.columnDefs, this.getAdminReviewColumnGroup()];
    } else if (this.isLoggedIn) {
      this.columnDefs = [...this.columnDefs, this.getReadOnlyCommentColumnGroup()];
    }
  }

  private reviewGroupBase(): Pick<ColGroupDef, 'groupId' | 'headerClass'> {
    return {
      groupId: 'review',
      headerClass: 'review-header-group',
    };
  }

  private getReadOnlyCommentColumnGroup(): ColGroupDef {
    return {
      ...this.reviewGroupBase(),
      headerName: 'Note',
      children: [
        {
          headerName: 'Comment',
          field: 'admin_comment',
          pinned: 'right',
          minWidth: 200,
          maxWidth: 280,
          sortable: false,
          filter: 'agTextColumnFilter',
          cellClass: 'review-comment-readonly',
          valueFormatter: (params) => params.value ?? '—',
        },
      ],
    };
  }

  private getAdminReviewColumnGroup(): ColGroupDef {
    return {
      ...this.reviewGroupBase(),
      headerName: 'Review',
      children: [
        {
          headerName: 'Comment',
          field: 'admin_comment',
          pinned: 'right',
          minWidth: 180,
          width: 220,
          sortable: false,
          filter: 'agTextColumnFilter',
          cellClass: 'review-comment-cell',
          suppressMovable: true,
          cellRenderer: (params: any) => {
            const wrap = document.createElement('div');
            wrap.className = 'review-comment-wrap';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'review-comment-input';
            input.value = params.data.admin_comment ?? '';
            input.placeholder = 'Add comment…';
            input.oninput = () => {
              params.data.admin_comment = input.value;
            };
            wrap.appendChild(input);
            return wrap;
          },
        },
        {
          headerName: 'Show',
          field: 'row_review_visible',
          pinned: 'right',
          width: 52,
          minWidth: 52,
          maxWidth: 52,
          resizable: false,
          sortable: false,
          filter: false,
          suppressMovable: true,
          cellClass: 'review-visible-cell',
          cellRenderer: (params: any) => {
            const wrap = document.createElement('div');
            wrap.className = 'review-cell-center';
            const visible = params.data.visible_flag !== false;
            const eyeBtn = document.createElement('button');
            eyeBtn.type = 'button';
            eyeBtn.className = 'review-icon-btn' + (visible ? '' : ' review-icon-btn--hidden');
            eyeBtn.title = visible ? 'Visible — click to hide' : 'Hidden — click to show';
            eyeBtn.innerHTML = visible
              ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
              : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
            eyeBtn.onclick = (e) => {
              e.stopPropagation();
              params.data.visible_flag = !visible;
              params.api.refreshCells({ rowNodes: [params.node], columns: ['row_review_visible'], force: true });
            };
            wrap.appendChild(eyeBtn);
            return wrap;
          },
        },
        {
          headerName: 'Save',
          field: 'row_review_save',
          pinned: 'right',
          width: 76,
          minWidth: 76,
          maxWidth: 76,
          resizable: false,
          sortable: false,
          filter: false,
          suppressMovable: true,
          cellClass: 'review-save-cell',
          cellRenderer: (params: any) => {
            const wrap = document.createElement('div');
            wrap.className = 'review-cell-center';
            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'review-save-btn';
            saveBtn.textContent = 'Save';
            saveBtn.title = 'Save changes';
            saveBtn.onclick = (e) => {
              e.stopPropagation();
              this.saveRowMetadata(params.data, saveBtn);
            };
            wrap.appendChild(saveBtn);
            return wrap;
          },
        },
      ],
    };
  }

  private saveRowMetadata(row: any, btn: HTMLButtonElement): void {
    const files = [row.shimmer1_full_file_name, row.shimmer2_full_file_name].filter(
      (f): f is string => !!f
    );
    if (!files.length) {
      this.showToast('No files on this row to save.');
      return;
    }
    btn.disabled = true;
    btn.style.opacity = '0.6';
    this.apiService
      .patchDecodedFilesMetadata({
        files,
        visible_flag: row.visible_flag !== false,
        admin_comment: row.admin_comment?.trim() ? row.admin_comment.trim() : null,
      })
      .subscribe({
        next: () => {
          this.showToast('Row saved.');
          btn.disabled = false;
          btn.style.opacity = '1';
        },
        error: (err) => {
          console.error('Failed to save row metadata', err);
          alert('Failed to save. Is the backend deployed?');
          btn.disabled = false;
          btn.style.opacity = '1';
        },
      });
  }

  private applyRowVisibilityFilter(rows: any[]): any[] {
    if (this.isAdmin) return rows;
    return rows.filter((row) => row.visible_flag !== false);
  }

  private loadGridData(): void {
    this.isLoading = true;
    this.apiService.listFilesCombinedMeta().subscribe({
      next: (resp: any) => {
        if (resp && Array.isArray(resp.data)) {
          const rows = resp.data.flatMap((item: any) => {
            const shimmer1Arr = item.shimmer1_decoded || [];
            const shimmer2Arr = item.shimmer2_decoded || [];
            const maxLen = Math.max(shimmer1Arr.length, shimmer2Arr.length);
            const itemRows = [];
            for (let i = 0; i < maxLen; i++) {
              const s1 = shimmer1Arr[i] || {};
              const s2 = shimmer2Arr[i] || {};
              itemRows.push({
                patient: item.patient,
                device: item.device,
                date: item.date,
                shimmer1: item.shimmer1,
                shimmer2: item.shimmer2,
                startRecordedSortMs: this.rowStartRecordedSortMs(s1, s2),
                visible_flag: this.rowVisibleFlag(s1, s2),
                admin_comment: this.rowAdminComment(s1, s2),
                shimmer1_recorded_timestamp: s1.recordedTimestamp ? this.formatRecordedTimestamp(s1.recordedTimestamp) : null,
                shimmer1_end_recorded_timestamp: s1.endRecordedTimestamp
                  ? this.formatRecordedTimestamp(s1.endRecordedTimestamp)
                  : null,
                shimmer1_time: s1.time,
                shimmer1_full_file_name: s1.full_file_name,
                shimmer1_mac_address: s1.macAddress,
                shimmer1_experiment_name: s1.experiment_name,
                shimmer1_shimmer_device: s1.shimmer_device,
                shimmer1_filename: s1.filename,
                shimmer1_shimmer_day: s1.shimmer_day,
                shimmer1_part: s1.part,
                shimmer1_accel_var: s1.Accel_WR_VAR ? parseFloat(Number(s1.Accel_WR_VAR).toFixed(4)) : null,
                shimmer2_recorded_timestamp: s2.recordedTimestamp ? this.formatRecordedTimestamp(s2.recordedTimestamp) : null,
                shimmer2_end_recorded_timestamp: s2.endRecordedTimestamp
                  ? this.formatRecordedTimestamp(s2.endRecordedTimestamp)
                  : null,
                shimmer2_time: s2.time,
                shimmer2_full_file_name: s2.full_file_name,
                shimmer2_mac_address: s2.macAddress,
                shimmer2_experiment_name: s2.experiment_name,
                shimmer2_shimmer_device: s2.shimmer_device,
                shimmer2_filename: s2.filename,
                shimmer2_shimmer_day: s2.shimmer_day,
                shimmer2_part: s2.part,
                shimmer2_accel_var: s2.Accel_WR_VAR ? parseFloat(Number(s2.Accel_WR_VAR).toFixed(4)) : null,
              });
            }
            return itemRows;
          });
          rows.sort((a: { startRecordedSortMs: number }, b: { startRecordedSortMs: number }) =>
            b.startRecordedSortMs - a.startRecordedSortMs
          );
          this.allRowData = rows;
          this.rowData = this.applyRowVisibilityFilter(rows);
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  ngOnInit(): void {
    // Set initial filter from input if provided
    if (this.initialFilter) {
      this.quickFilterText = this.initialFilter;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialFilter']?.currentValue) {
      this.quickFilterText = changes['initialFilter'].currentValue;
    }
    if (changes['isLoggedIn'] || changes['isAdmin']) {
      this.syncReviewColumns();
      if (this.allRowData.length) {
        this.rowData = this.applyRowVisibilityFilter(this.allRowData);
        if (!changes['initialFilter']) {
          return;
        }
      }
    }
    this.loadGridData();
  }

  gridOptions: any;
}

