'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Filter, ChevronDown } from 'lucide-react'

export interface AdvancedFilters {
  searchTerm: string
  status: 'all' | 'active' | 'inactive' | 'archived'
  personType: 'all' | 'pf' | 'pj'
  dateFrom: string
  dateTo: string
  sortBy: 'name' | 'createdAt' | 'lastSync'
  sortOrder: 'asc' | 'desc'
}

interface CustomerFiltersProps {
  filters: AdvancedFilters
  onFiltersChange: (filters: AdvancedFilters) => void
  onReset: () => void
  totalResults: number
  isLoading?: boolean
}

export function CustomerFilters({
  filters,
  onFiltersChange,
  onReset,
  totalResults,
  isLoading = false,
}: CustomerFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const activeFilterCount = [
    filters.searchTerm !== '',
    filters.status !== 'all',
    filters.personType !== 'all',
    filters.dateFrom !== '',
    filters.dateTo !== '',
  ].filter(Boolean).length

  const handleSearchChange = (value: string) => {
    onFiltersChange({
      ...filters,
      searchTerm: value,
    })
  }

  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value as AdvancedFilters['status'],
    })
  }

  const handlePersonTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      personType: value as AdvancedFilters['personType'],
    })
  }

  const handleDateFromChange = (value: string) => {
    onFiltersChange({
      ...filters,
      dateFrom: value,
    })
  }

  const handleDateToChange = (value: string) => {
    onFiltersChange({
      ...filters,
      dateTo: value,
    })
  }

  const handleSortByChange = (value: string) => {
    onFiltersChange({
      ...filters,
      sortBy: value as AdvancedFilters['sortBy'],
    })
  }

  const handleSortOrderChange = (value: string) => {
    onFiltersChange({
      ...filters,
      sortOrder: value as AdvancedFilters['sortOrder'],
    })
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Buscar por nome, email ou CPF/CNPJ..."
            value={filters.searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            disabled={isLoading}
            className="w-full"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative"
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Advanced Filters Panel */}
      {isExpanded && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Filtros Avançados</CardTitle>
              <div className="flex gap-2">
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onReset}
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                >
                  <ChevronDown className="h-4 w-4 transform rotate-180" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={filters.status}
                  onValueChange={handleStatusChange}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Person Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Pessoa</label>
                <Select
                  value={filters.personType}
                  onValueChange={handlePersonTypeChange}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                    <SelectItem value="pj">Pessoa Jurídica (PJ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Ordenar por</label>
                <Select
                  value={filters.sortBy}
                  onValueChange={handleSortByChange}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar ordem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nome</SelectItem>
                    <SelectItem value="createdAt">Data de Criação</SelectItem>
                    <SelectItem value="lastSync">Última Sincronização</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Order Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Ordem</label>
                <Select
                  value={filters.sortOrder}
                  onValueChange={handleSortOrderChange}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar ordem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Crescente</SelectItem>
                    <SelectItem value="desc">Decrescente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date From Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* Date To Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Final</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalResults > 0
            ? `Mostrando ${totalResults} cliente(s)`
            : 'Nenhum cliente encontrado'}
        </span>
        {activeFilterCount > 0 && (
          <span className="text-primary font-medium">
            {activeFilterCount} filtro(s) aplicado(s)
          </span>
        )}
      </div>
    </div>
  )
}
