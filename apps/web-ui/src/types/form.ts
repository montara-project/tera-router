import type { UseMutationResult } from '@tanstack/react-query'

import z from 'zod'

import type { ApiItemResponse } from './api'

type Mutation<TVariables, TResponse = TVariables> = UseMutationResult<
  ApiItemResponse<TResponse> | undefined,
  Error,
  TVariables,
  unknown
>

export interface BaseAbstractForm<TModel, TMutation, TDto, TResponse = TMutation> {
  defaultValues: TModel
  schema: z.ZodType<TDto, TDto, any>
  mutation: Mutation<TMutation, TResponse>
  isEdit?: boolean
}
