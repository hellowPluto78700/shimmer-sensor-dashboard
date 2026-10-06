import { Component, OnInit } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent, IHeaderComp, IHeaderParams } from 'ag-grid-community';
import { ApiService, FileItem } from '../../services/api.service';

class ClearFilterHeader implements IHeaderComp {
  private eGui!: HTMLElement;
  private btn!: HTMLButtonElement;
  private params!: IHeaderParams;
  private clickHandler!: () => void;

  init(params: IHeaderParams): void {
    this.params = params;
    const eGui = document.createElement('div');
    eGui.style.display = 'flex';
    eGui.style.alignItems = 'center';
    eGui.style.gap = '6px';

    const label = document.createElement('span');
    label.textContent = params.displayName ?? params.column.getColId();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ag-hdr-clear-btn';
    btn.title = 'Clear filter';
    btn.setAttribute('aria-label', 'Clear filter');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    this.clickHandler = () => {
      const api = this.params.api;
      const colId = this.params.column.getColId();
      const model = (api.getFilterModel() || {}) as any;
      model[colId] = null; // set to null so floating filter UI also clears
      api.setFilterModel(model);
      // notify host component to sync toolbar inputs
      const ctx: any = this.params.context;
      if (ctx && typeof ctx.onClear === 'function') {
        ctx.onClear(colId);
      }
    };

    btn.addEventListener('click', this.clickHandler);

    eGui.appendChild(label);
    eGui.appendChild(btn);

    this.eGui = eGui;
    this.btn = btn;
  }

  getGui(): HTMLElement { return this.eGui; }
  destroy(): void { this.btn?.removeEventListener('click', this.clickHandler); }
  refresh(params: IHeaderParams): boolean { this.params = params; return true; }
}

@Component({
  selector: 'app-files-grid',
  standalone: false,
  templateUrl: './files-grid.html',
  styleUrls: ['./files-grid.css']
})
export class FilesGrid implements OnInit {
  private gridApi?: GridApi;
  components = { clearFilterHeader: ClearFilterHeader };
  context = { onClear: (colId: string) => this.onHeaderClear(colId) };

  private static parseTimeToSeconds(t?: string): number {
    if (!t) return 0;
    const m = t.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return 0;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = Number(m[3]);
    return (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0);
  }

  private static compareYyyyMmDd(filterDate: Date, cellValue?: string): number {
    if (!cellValue) return -1;
    const [y, m, d] = cellValue.split('-').map(Number);
    const cellDate = new Date(y, (m || 1) - 1, d || 1);
    const fd = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
    const cd = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
    if (cd < fd) return -1;
    if (cd > fd) return 1;
    return 0;
  }

  expandedFiles: any[] = [];
  showPopup = false;
  popupTimeFrom = '';
  popupTimeTo = '';
  expandedRowData: any = null; // Store the row data to access date

  columnDefs: ColDef[] = [
    { headerName: 'Patient', field: 'patient', headerComponent: 'clearFilterHeader', filter: 'agTextColumnFilter', sortable: true, flex: 1 },
    { headerName: 'Device', field: 'device', headerComponent: 'clearFilterHeader', filter: 'agTextColumnFilter', sortable: true, flex: 1, hide: false, valueGetter: params => params.data?.device },
    {
      headerName: 'Date',
      field: 'date',
      headerComponent: 'clearFilterHeader',
      filter: 'agDateColumnFilter',
      filterParams: {
        comparator: (filterLocalDateAtMidnight: Date, cellValue: string) =>
          FilesGrid.compareYyyyMmDd(filterLocalDateAtMidnight, cellValue),
        browserDatePicker: true
      },
      sortable: true,
      flex: 1
    },
    { headerName: 'Experiment Name', field: 'experiment_name', headerComponent: 'clearFilterHeader', filter: 'agTextColumnFilter', sortable: true, flex: 1 },
    { headerName: 'Left Hand Device', field: 'shimmer1', headerComponent: 'clearFilterHeader', filter: 'agTextColumnFilter', sortable: true, flex: 1 },
    { headerName: 'Right Hand Device', field: 'shimmer2', headerComponent: 'clearFilterHeader', filter: 'agTextColumnFilter', sortable: true, flex: 1 },

    {
      headerName: 'Actions',
      field: 'actions',
      width: 100,
      cellRenderer: (params: any) => `
        <button type="button" class="ag-action-btn ag-action-icon" aria-label="Download" title="Download">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button type="button" class="ag-action-btn ag-action-expand" aria-label="Expand" title="Expand">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </button>
      `,
      sortable: false,
      filter: false
    }
  ];

  popupColumnDefs: ColDef[] = [
    { headerName: 'Time', field: 'time', filter: 'agTextColumnFilter', sortable: true, flex: 1 },
    { headerName: 'Filename', field: 'fullname', filter: 'agTextColumnFilter', sortable: true, flex: 2, hide: true},
    { headerName: 'Shimmer Device', field: 'shimmer_device', filter: 'agTextColumnFilter', sortable: true, flex: 1 },
    { headerName: 'Shimmer Day', field: 'shimmer_day', filter: 'agTextColumnFilter', sortable: true, flex: 1 },
    // {
    //   headerName: 'Actions',
    //   field: 'decode',
    //   flex: 1,
    //   cellRenderer: (params: any) => `
    //     <button class='ag-action-btn' data-decode='${params.data.fullname}' aria-label='Decode file' title='Decode file'>
    //       <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
    //         <rect x='3' y='11' width='18' height='10' rx='2' ry='2'/>
    //         <path d='M7 11V7a5 5 0 0 1 10 0v4'/>
    //         <circle cx='12' cy='16' r='1.5'/>
    //         <line x1='12' y1='18' x2='12' y2='21'/>
    //         <line x1='9' y1='13' x2='9' y2='17'/>
    //         <line x1='15' y1='13' x2='15' y2='17'/>
    //         <circle cx='6' cy='21' r='0.5'/>
    //         <circle cx='18' cy='21' r='0.5'/>
    //         <line x1='6' y1='21' x2='7' y2='19'/>
    //         <line x1='18' y1='21' x2='17' y2='19'/>
    //       </svg>
    //     </button>`
    // }
  ];

  defaultColDef: ColDef = { resizable: true, filter: true, sortable: true, floatingFilter: true };

  rowData: FileItem[] = [];
  quickFilterText = '';

  pageSize = 25;
  pageSizeOptions = [10, 25, 50, 100];

  timeFrom = '';
  timeTo = '';
  isDownloadingAll = false;
  downloadAllUrl = '';

  // Error handling state
  isLoading = false;
  loadError = '';
  actionError = '';

  // Patient toolbar filter
  selectedPatient = '';
  get uniquePatients(): string[] {
    const s = new Set<string>();
    for (const r of this.rowData) {
      if (r.patient) s.add(r.patient);
    }
    return Array.from(s).sort();
  }

  private readonly downloadBase: string = 'https://wwr1eh4vg9.execute-api.us-east-2.amazonaws.com/download/';

  // Global screen loader flag
  isScreenLoading = false;

  // Decode state
  isDecoding = false;
  decodeError = '';
  decodedResult: any = null;
  selectedFileName: string = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.api.listFilesParsed().subscribe({
      next: (resp: any) => {
        console.log('API response from listFilesParsed:', resp);
        let rawData: any[] = [];
        if (Array.isArray(resp)) {
          rawData = resp;
        } else if (Array.isArray(resp?.data)) {
          rawData = resp.data;
        }
        
        // Filter out files in "decode/" folder
        this.rowData = rawData.map(item => {
          if (item.files && Array.isArray(item.files)) {
            return {
              ...item,
              files: item.files.filter((file: any) => {
                const fullname = file?.fullname || '';
                // Exclude files in decode/ folder and .zip files
                return !fullname.startsWith('decode/') && !fullname.endsWith('.zip');
              })
            };
          }
          return item;
        }).filter(item => item.files && item.files.length > 0); // Remove items with no files left
        
        console.log('FilesGrid processed rowData (excluding decode/):', this.rowData);
        this.loadError = '';
        this.isLoading = false;
      },
      error: err => {
        console.error('Failed to load files', err);
        this.rowData = [];
        this.loadError = 'Failed to load files. Please try again.';
        this.isLoading = false;
      }
    });
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
  }

  onQuickFilterChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.quickFilterText = input?.value ?? '';
  }

  onPageSizeChange(event: Event) {
    const val = Number((event.target as HTMLSelectElement).value);
    this.pageSize = val;
  }

  applyTimeRangeFilter() {
    if (!this.gridApi) return;
    const fromSec = FilesGrid.parseTimeToSeconds(this.timeFrom);
    const toSec = FilesGrid.parseTimeToSeconds(this.timeTo);
    if (!fromSec && !toSec) {
      this.clearColumnFilter('time');
      return;
    }
    const model = { filterType: 'number', type: 'inRange', filter: fromSec || 0, filterTo: toSec || 86399 } as any;
    const fm = this.gridApi.getFilterModel() || {};
    (fm as any)['time'] = model;
    this.gridApi.setFilterModel(fm);
  }

  applyPatientFilter() {
    if (!this.gridApi) return;
    const fm = (this.gridApi.getFilterModel() || {}) as any;
    if (!this.selectedPatient) {
      delete fm['patient'];
      this.gridApi.setFilterModel(Object.keys(fm).length ? fm : null);
      return;
    }
    fm['patient'] = { filterType: 'set', values: [this.selectedPatient] };
    this.gridApi.setFilterModel(fm);
  }

  clearColumnFilter(colKey: string) {
    if (!this.gridApi) return;
    const fm = (this.gridApi.getFilterModel() || {}) as any;
    fm[colKey] = null; // set to null to fully reset including floating filter UI
    this.gridApi.setFilterModel(fm);
  }

  clearTimeFilter() {
    this.timeFrom = '';
    this.timeTo = '';
    this.clearColumnFilter('time');
  }

  clearDateFilter() {
    this.clearColumnFilter('date');
  }

  clearAllFilters() {
    if (!this.gridApi) return;
    this.gridApi.setFilterModel(null);
    this.timeFrom = '';
    this.timeTo = '';
    this.selectedPatient = '';
  }
  
  // Stream download helper: keeps loader active until the file finishes downloading
  private async streamDownload(url: string, filenameHint?: string) {
    try {
      const resp = await fetch(url, { credentials: 'include', mode: 'cors' as RequestMode });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const blob = await resp.blob();
      const cd = resp.headers.get('content-disposition') || '';
      const suggested = this.getFilenameFromContentDisposition(cd) || filenameHint || 'download';
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = suggested;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (e) {
      console.error('Stream download failed, falling back to navigation', e);
      try { window.location.href = url; } catch {}
    } finally {
      this.isScreenLoading = false;
      this.isDownloadingAll = false;
    }
  }

  private getFilenameFromContentDisposition(cd: string): string | null {
    try {
      const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
      if (!m) return null;
      const fn = decodeURIComponent(m[1] || m[2]);
      return fn || null;
    } catch { return null; }
  }

  onCellClicked(event: any) {
    if (event.colDef.field !== 'actions') return;
    let target = event.event.target as HTMLElement;
    // Traverse up to button if SVG or child is clicked
    while (target && target.tagName !== 'BUTTON' && target.parentElement) {
      target = target.parentElement;
    }
    const files = event.data?.files;
    if (!Array.isArray(files) || !files.length) return;
    const classList = target.getAttribute('class') || '';
    if (classList.includes('ag-action-icon')) {
      this.actionError = '';
      this.isScreenLoading = true;
      this.downloadZipByUserDate(files);
    } else if (classList.includes('ag-action-expand')) {
      console.log('Expand clicked, files:', files);
      this.expandedFiles = files;
      this.expandedRowData = event.data; // Store row data to access date
      this.showPopup = true;
      this.popupTimeFrom = '';
      this.popupTimeTo = '';
    }
  }

  get filteredPopupFiles() {
    if (!this.popupTimeFrom && !this.popupTimeTo) return this.expandedFiles;
    const fromSec = FilesGrid.parseTimeToSeconds(this.popupTimeFrom);
    const toSec = FilesGrid.parseTimeToSeconds(this.popupTimeTo);
    return this.expandedFiles.filter(f => {
      const tSec = FilesGrid.parseTimeToSeconds(f.time);
      if (fromSec && tSec < fromSec) return false;
      if (toSec && tSec > toSec) return false;
      return true;
    });
  }

  closePopup() {
    this.showPopup = false;
    this.expandedFiles = [];
    this.expandedRowData = null;
    this.popupTimeFrom = '';
    this.popupTimeTo = '';
  }

  private downloadZipByUserDate(files: any[]) {
    fetch('https://wwr1eh4vg9.execute-api.us-east-2.amazonaws.com/download-zip-by-user-date/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify(files)
    })
      .then(resp => resp.json())
      .then(data => {
        if (data?.download_url) {
          window.open(data.download_url, '_blank');
        } else {
          this.actionError = 'Download URL not received.';
        }
        this.isScreenLoading = false;
      })
      .catch(err => {
        console.error('Failed to get zip download URL', err);
        this.actionError = 'Failed to start download. Please try again.';
        this.isScreenLoading = false;
      });
  }

  downloadAll() {
    if (this.isDownloadingAll) {
      return;
    }
    this.isDownloadingAll = true;
    this.isScreenLoading = true;
    this.downloadAllUrl = '';
    this.actionError = '';
    this.api.getDownloadAllUrl().subscribe({
      next: ({ url }) => {
        const target = url || this.api.buildDownloadAllUrl();
        this.downloadAllUrl = target;
        // Keep loader until the bulk file is fully received
        void this.streamDownload(target, 'shimmer-files.zip');
      },
      error: (e) => {
        console.error('Failed to get download-all URL', e);
        this.isDownloadingAll = false;
        this.isScreenLoading = false;
        this.downloadAllUrl = this.api.buildDownloadAllUrl();
        this.actionError = 'Could not generate a pre-signed URL.';
      }
    });
  }

  onHeaderClear(colId: string) {
    if (!this.gridApi) return;
    const fm = (this.gridApi.getFilterModel() || {}) as any;
    fm[colId] = null;
    this.gridApi.setFilterModel(fm);
    if (colId === 'patient') this.selectedPatient = '';
    if (colId === 'time') { this.timeFrom = ''; this.timeTo = ''; }
  }

  onPopupGridReady(e: GridReadyEvent) {
    e.api.addEventListener('cellClicked', (event: any) => {
      if (event.colDef.field === 'decode') {
        this.decodeFileInPopup(event.data);
      }
    });
  }

  decodeFileInPopup(rowData: any) {
    this.selectedFileName = rowData.fullname || rowData.filename || '';
    this.isDecoding = true;
    this.decodeError = '';
    this.decodedResult = null;
    this.api.decodeFile(rowData.fullname).subscribe({
      next: (resp: any) => {
        this.decodedResult = resp;
        this.isDecoding = false;
      },
      error: (err: any) => {
        this.decodeError = 'Failed to decode file.';
        this.isDecoding = false;
      }
    });
  }
}
